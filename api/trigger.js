const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const PAGE_ID = '383560435152696';
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

module.exports = async (req, res) => {
  // ✅ Facebook Webhook 验证 (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    } else {
      return res.status(403).send('验证失败');
    }
  }

  // ✅ 拒绝非 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const body = req.body;

  if (body.entry) {
    for (const entry of body.entry) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const comment = change.value;

        if (!comment || comment.item !== 'comment' || comment.verb !== 'add') continue;
        if (comment.from?.id === PAGE_ID) continue;

        const commentId = comment.comment_id;
        const message = comment.message || '';
        const postId = comment.post_id;

        const { data: existing } = await supabase
          .from('faq_handled_comments')
          .select('comment_id')
          .eq('comment_id', commentId)
          .maybeSingle();

        if (existing) continue;

        await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment_id: commentId, message, post_id: postId })
        });

        await supabase.from('faq_handled_comments').insert({ comment_id: commentId });
      }
    }
  }

  res.status(200).send('OK');
};
