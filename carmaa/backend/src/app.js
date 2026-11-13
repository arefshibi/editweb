import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { csrfOriginGuard } from './middleware/security.js';
import authRouter from './routes/auth.js';
import listingsRouter from './routes/listings.js';
import showroomsRouter from './routes/showrooms.js';
import showroomReportRouter from './routes/showroom-report.js';
import messagesRouter from './routes/messages.js';
import paymentsRouter from './routes/payments.js';
import notificationsRouter from './routes/notifications.js';
import qaRouter from './routes/qa.js';
import uploadsRouter from './routes/uploads.js';
import adminRouter from './routes/admin.js';
import accountRouter from './routes/account.js';
import reportsRouter from './routes/reports.js';
import socialRouter from './routes/social.js';
import supportRouter from './routes/support.js';
import newsRouter from './routes/news.js';
import adCardsRouter from './routes/ad-cards.js';
import bannersRouter from './routes/banners.js';
import partnersRouter from './routes/partners.js';
import liveRouter from './live.js';
import { pool } from './db.js';
import { redis, createRateLimiter } from './middleware/security.js';
import { mediaUsesS3 } from './services/media.js';

const app = express();
const healthReadyLimit = createRateLimiter({ name: 'health-ready', windowSeconds: 60, max: 30 });
const globalApiLimit = createRateLimiter({ name: 'api-global', windowSeconds: 60, max: 600 });
const here = path.dirname(fileURLToPath(import.meta.url));
app.disable('x-powered-by');
app.set('trust proxy', config.TRUST_PROXY === '1' ? 1 : false);

app.use(pinoHttp({
  genReqId: (_req, res) => { const id = crypto.randomUUID(); res.setHeader('X-Request-ID', id); return id; },
  redact: ['req.headers.authorization','req.headers.cookie','res.headers.set-cookie'],
  serializers: {
    req(req) { return { id:req.id, method:req.method, url:String(req.url || '').split('?')[0], remoteAddress:req.remoteAddress }; },
    res(res) { return { statusCode:res.statusCode }; },
  },
  customLogLevel: (_req,res,err) => err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
  quietReqLogger: true,
}));
app.use(helmet({
  contentSecurityPolicy: { directives: { defaultSrc:["'none'"], baseUri:["'none'"], frameAncestors:["'none'"], formAction:["'self'"], objectSrc:["'none'"] } },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy:'no-referrer' },
  strictTransportSecurity: { maxAge: 15552000, includeSubDomains: false }, // SEC-PATCH (S14)
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials:true,
  methods:['GET','HEAD','POST','PATCH','PUT','DELETE','OPTIONS'],
  allowedHeaders:['Content-Type','Authorization','Idempotency-Key','X-Request-ID'],
  maxAge:600,
}));
app.use(express.json({ limit:'1mb', strict:true, type:['application/json','application/*+json'] }));
app.use(express.urlencoded({ extended:false, limit:'16kb', parameterLimit:50 }));
app.use(cookieParser());

app.get('/health/live', (_req,res)=>res.json({ok:true}));
app.get('/health/ready', healthReadyLimit, async (_req,res)=>{
  try { await pool.query('SELECT 1'); await redis.ping(); res.json({ok:true,dependencies:{database:'ok',redis:'ok'}}); }
  catch { res.status(503).json({ok:false,dependencies:{database:'unknown',redis:'unknown'}}); }
});

if (!mediaUsesS3()) {
  // Filenames are generated server-side as random UUIDs and contain no user-supplied path.
  const mediaRoot = config.mediaRoot;
  app.use('/media', express.static(mediaRoot, { immutable:true, maxAge:'1y', fallthrough:false, dotfiles:'deny', index:false, setHeaders(res) { res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Cross-Origin-Resource-Policy','cross-origin'); res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox"); } }));
}

// Broad IP-level ceiling protects read-heavy/public endpoints too; sensitive
// routes retain stricter route-specific limits below.
app.use('/api/v1', globalApiLimit, csrfOriginGuard);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/listings', listingsRouter);
app.use('/api/v1/showrooms/mine/report', showroomReportRouter);
app.use('/api/v1/showrooms', showroomsRouter);
app.use('/api/v1/messages', messagesRouter);
app.use('/api/v1/payments', paymentsRouter);
app.use('/api/v1/notifications', notificationsRouter);
// Q&A disabled (temporary): app.use('/api/v1/qa', qaRouter);
app.use('/api/v1/qa', (_req, res) => res.status(503).json({ error: 'qa_disabled', message: 'بخش پرسش‌وپاسخ موقتاً غیرفعال است.' }));
app.use('/api/v1/uploads', uploadsRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/account', accountRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/social', socialRouter);
app.use('/api/v1/support', supportRouter);
app.use('/api/v1/news', newsRouter);
app.use('/api/v1/ad-cards', adCardsRouter);
app.use('/api/v1/banners', bannersRouter);
app.use('/api/v1/partners', partnersRouter);
app.use('/api/v1/live', liveRouter);

app.use('/api', (_req,res)=>res.status(404).json({error:{code:'API_NOT_FOUND',message:'مسیر API پیدا نشد.'}}));
app.use((err,req,res,_next)=>{
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status <= 599 ? err.status : 500;
  if (status >= 500) req.log?.error({ event:'request_failed', requestId:req.id, errorName:err.name || 'Error', errorCode:err.code || 'INTERNAL' }, 'Request failed');
  if (res.headersSent) return;
  const publicMessage = status >= 500 ? 'خطای داخلی رخ داد. با کد پیگیری درخواست پشتیبانی تماس بگیرید.' : String(err.message || 'درخواست معتبر نیست.').slice(0,250);
  res.status(status).json({ error:{ code:status >= 500 ? 'INTERNAL_ERROR' : (err.code || 'REQUEST_FAILED'), message:publicMessage, requestId:req.id } });
});

export default app;
