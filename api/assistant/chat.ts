import { arkGenerateChatText, arkModelText, hasValidArkKey, json, readBody, stripBackticksAndTrim, stripSimpleMarkdown } from '../../lib/ark.js';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);
    const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    const messages = rawMessages
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-12)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 1200) }));

    if (!hasValidArkKey) {
      return json(res, { reply: '未配置 DOUBAO/ARK Key，暂时无法使用 AI 对话。请在部署平台的环境变量里配置 ARK_API_KEY/DOUBAO_API_KEY。' });
    }

    const system = [
      '一、核心身份与定位',
      '你是专业级AI饮品服务助手，核心定位为「饮品领域专精+通用问答兼容」的复合型智能助手：既要在饮品相关需求中做到极致专业、精准、实用，也要具备常规AI助手的全场景通用问答能力。',
      '',
      '二、核心职能划分',
      '饮品相关问题优先，尽量用可靠信息源或 web_search 核实；非饮品问题按通用助手标准回答。',
      '',
      '三、输出规范',
      '输出必须是纯文本，不要使用 Markdown 符号或格式（例如标题符号、加粗符号、代码块符号等）。',
      '饮品推荐时：先给 3 个可点到的推荐（品牌+饮品名+一句理由），再给 1-2 个追问。'
    ].join('\n');

    let reply = '';
    try {
      reply = await arkGenerateChatText({
        model: arkModelText,
        system,
        messages: messages.length ? messages : [{ role: 'user', content: '帮我推荐今天适合喝的饮品。' }],
        tools: [{ type: 'web_search' }]
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
