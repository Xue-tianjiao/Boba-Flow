import { arkGenerateChatText, arkGenerateChatTextStream, arkModelText, hasValidArkKey, json, readBody, stripBackticksAndTrim, stripSimpleMarkdown } from '../../lib/ark.js';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);
    const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    const messages = rawMessages
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-8)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 1200) }));

    if (!hasValidArkKey) {
      const wantsSse =
        String(req?.headers?.accept || '').includes('text/event-stream') ||
        body?.stream === true;
      if (wantsSse) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders?.();
        res.write(`event: error\ndata: ${JSON.stringify({ error: 'Missing ARK_API_KEY/DOUBAO_API_KEY' })}\n\n`);
        res.write(`event: done\ndata: ${JSON.stringify({ reply: '未配置 DOUBAO/ARK Key，暂时无法使用 AI 对话。请在部署平台的环境变量里配置 ARK_API_KEY/DOUBAO_API_KEY。' })}\n\n`);
        res.end();
        return;
      }

      return json(res, { reply: '未配置 DOUBAO/ARK Key，暂时无法使用 AI 对话。请在部署平台的环境变量里配置 ARK_API_KEY/DOUBAO_API_KEY。' });
    }

    const system = [
      '你是饮品领域专业助手，也能回答通用问题。',
      '输出纯文本，不要 Markdown。',
      '做推荐时：给 3 个推荐（品牌+饮品名+一句理由），再问 1-2 个澄清问题。'
    ].join('\n');

    const lastUserText = String(messages.slice().reverse().find((m: any) => m?.role === 'user')?.content || '');
    const needsFreshInfo = /\b(latest|news|update)\b/i.test(lastUserText) || /最新|最近|上新|新品|新闻|更新|链接|出处|来源|官网|价格|搜|搜索|查/.test(lastUserText);
    const tools = needsFreshInfo ? [{ type: 'web_search' }] : undefined;

    const wantsSse =
      String(req?.headers?.accept || '').includes('text/event-stream') ||
      body?.stream === true;

    if (wantsSse) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      const heartbeat = setInterval(() => {
        try {
          res.write(': keep-alive\n\n');
        } catch {
        }
      }, 15000);

      const abortController = new AbortController();
      const closeHandler = () => abortController.abort();
      res.on?.('close', closeHandler);

      let fullReply = '';
      let pending = '';
      const flush = () => {
        if (!pending) return;
        const chunk = pending;
        pending = '';
        try {
          res.write(`event: delta\ndata: ${JSON.stringify({ delta: chunk })}\n\n`);
        } catch {
        }
      };
      const flushTimer = setInterval(flush, 60);
      try {
        res.write(`event: open\ndata: ${JSON.stringify({ ok: true })}\n\n`);

        fullReply = await arkGenerateChatTextStream({
          model: arkModelText,
          system,
          messages: messages.length ? messages : [{ role: 'user', content: '帮我推荐今天适合喝的饮品。' }],
          tools,
          signal: abortController.signal,
          onDelta: (delta) => {
            pending += delta;
          }
        });
      } catch (e: any) {
        const message = e?.message ? String(e.message) : 'Stream failed';
        res.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
      } finally {
        clearInterval(flushTimer);
        flush();
        clearInterval(heartbeat);
        res.off?.('close', closeHandler);
      }

      const cleaned = stripSimpleMarkdown(stripBackticksAndTrim(fullReply));
      res.write(`event: done\ndata: ${JSON.stringify({ reply: cleaned })}\n\n`);
      res.end();
      return;
    }

    let reply = '';
    try {
      reply = await arkGenerateChatText({
        model: arkModelText,
        system,
        messages: messages.length ? messages : [{ role: 'user', content: '帮我推荐今天适合喝的饮品。' }],
        tools
      });
    } catch {
      reply =
        '我这边暂时连不上服务，但我可以先给你一个不依赖联网的推荐：\n' +
        '1) 瑞幸：生椰拿铁（低糖可选），椰香顺口不腻\n' +
        '2) 星巴克：冰美式（无糖），清爽提神\n' +
        '3) 喜茶：清爽果茶（少糖/微糖），适合想喝点甜但控糖\n' +
        '你更偏咖啡还是茶饮？能接受冰的还是热的？';
    }

    const cleaned = stripSimpleMarkdown(stripBackticksAndTrim(reply));
    return json(res, { reply: cleaned });
  } catch (e: any) {
    return json(res, { error: e?.message ? String(e.message) : 'Assistant chat failed' }, 500);
  }
}
