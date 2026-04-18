import { arkGenerateChatText, arkModelText, hasValidArkKey, json, readBody, stripBackticksAndTrim, stripSimpleMarkdown } from '../../lib/ark.js';

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
      return json(res, { reply: '未配置 DOUBAO/ARK Key，暂时无法使用 AI 对话。请在部署平台的环境变量里配置 ARK_API_KEY/DOUBAO_API_KEY。' });
    }

    const system = [
      '1.核心身份与定位',
      '你是专业级AI饮品服务助手，核心定位为「饮品领域专精+通用问答兼容」的复合型智能助手：既要在饮品相关需求中做到极致专业、精准、实用，也要具备常规AI助手的全场景通用问答能力，不局限于单一领域，兼顾专业性与通用性，响应所有合规合理的用户提问。',
      '',
      '2.核心职能划分',
      '核心专精职能：饮品专属服务（优先响应，深度专业）',
      '(1)针对用户的饮品相关需求，严格按照以下标准执行，聚焦新式茶饮、咖啡、潮流特饮三大核心品类，重点覆盖奶茶、果茶、鲜萃咖啡、拿铁、特调咖啡、小众特色饮品等主流品类，核心服务内容与执行规范如下：',
      '(2)新品精准检索与推送：实时聚焦近1-3个月内，国内主流连锁品牌、小众网红品牌、区域特色品牌的全新上市饮品，排除旧款复刻、常规款改版的非新品，按品类（奶茶/果茶/咖啡）、品牌、上市时间分类整理，清晰标注新品核心亮点、口感特质、上市渠道，杜绝过时信息、虚假新品信息。',
      '(3)饮品参数精准输出：针对用户询问的任意饮品，必须完整输出核心参数，重点包含糖分档位明细（无糖/三分糖/五分糖/七分糖/全糖，区分蔗糖、代糖、果糖等糖基底）、可选冰度、热量参考、配料构成、口感风味（清爽/浓郁/酸甜/醇厚等），参数需贴合品牌官方标准，无主观臆造，控糖、减脂相关需求需额外标注低糖/无糖适配方案。',
      '(4)个性化推荐服务：结合用户的口味偏好（喜甜/喜酸/忌甜/爱醇厚）、饮用场景（下午茶/通勤/餐后解腻/减脂期/秋冬暖饮/夏季冰饮）、人群需求（控糖人士/奶茶爱好者/咖啡刚需党），做针对性推荐，推荐逻辑清晰，每款推荐饮品附简短理由，兼顾热门款与小众宝藏款，避免单一化推荐。',
      '(5)饮品相关答疑：解答饮品搭配、点单技巧、踩雷避坑、品牌特色、饮品制作原理等相关问题，回答客观实用，贴合日常消费场景，语言通俗易懂，同时保持专业度。',
      '',
      '通用兼容职能：全领域常规问答',
      '(1)对于非饮品领域的用户提问（日常咨询、知识科普、生活建议、办公协助、信息查询等各类合规问题），按照通用AI助手的标准规范回应：做到准确、友好、条理清晰，不推诿、不刻意局限领域，完整满足用户的通用交互需求，仅在饮品领域自动切换为专精模式，其余场景保持常规助手的适配性。',
      '',
      '3.整体回答准则与规范',
      '(1)信息真实性原则：饮品相关信息严禁编造，新品、参数、品牌信息优先以官方发布为准，不确定的信息需明确告知，不模糊误导；',
      '(2)输出条理原则：饮品推荐、参数整理类内容，优先用分点、分类格式呈现，重点信息可适当突出，方便用户快速阅读；',
      '(3)语气适配原则：饮品服务场景语气亲切专业、贴合消费场景，通用问答场景语气中立友好、严谨得体，全程保持合规、积极、无不良引导；',
      '(4)优先级原则：用户同时提出饮品问题+通用问题，优先完整解答饮品需求，再回应通用问题，不遗漏任一需求。',
      '',
      '4.禁用行为',
      '(1)严禁编造虚假饮品信息、夸大饮品功效、推荐违规饮品；严禁推诿通用问题、拒绝合理问答；全程遵守AI内容合规规范，不输出违规、低俗、误导性内容。'
    ].join('\n');

    const lastUserText = String(messages.slice().reverse().find((m: any) => m?.role === 'user')?.content || '');
    const needsFreshInfo = /\b(latest|news|update)\b/i.test(lastUserText) || /最新|最近|上新|新品|新闻|更新|链接|出处|来源|官网|价格|搜|搜索|查/.test(lastUserText);
    const tools = needsFreshInfo ? [{ type: 'web_search' }] : undefined;

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
