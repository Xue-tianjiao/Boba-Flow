import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

const ARK_API_KEY = process.env.ARK_API_KEY;
const MODEL = process.env.ARK_MODEL_TEXT || 'doubao-seed-2-0-pro-260215';

async function testImageSearch() {
  const url = 'https://ark.cn-beijing.volces.com/api/v3/responses';
  const body = {
    model: MODEL,
    tools: [
      {
        type: 'web_search',
        // Some users mention 'max_keyword' or other params, but let's stick to basic
      }
    ],
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: '搜索本周星巴克有什么新品。特别注意：请尽量找到这些新品的官方宣传图或实拍图的URL链接。如果搜到了图片链接，请务必在回答中列出。'
          }
        ]
      }
    ],
    thinking: { type: 'disabled' }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    const text = await res.text();
    console.log('Raw Response Length:', text.length);
    
    try {
        const json = JSON.parse(text);
        if (json.error) {
            console.error('API Error:', JSON.stringify(json.error, null, 2));
        } else {
            const output = json.output?.[0]?.content?.[0]?.text;
            console.log('Output Content:', output);
            
            // Check if any URLs look like images
            const imageRegex = /(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp))/gi;
            const matches = output?.match(imageRegex);
            if (matches) {
                console.log('Found Image URLs:', matches);
            } else {
                console.log('No direct image URLs found in text.');
            }
        }
    } catch (e) {
        console.log('Raw text:', text.slice(0, 500));
    }

  } catch (error) {
    console.error('Request failed:', error);
  }
}

testImageSearch();
