
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// 初始化 Supabase（使用 faq_handled_comments 表）
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const PAGE_ID = '101411206173416';
const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/thw3zhxlrqghf70fb5nyewyz1p05uljl';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const body = req.body;

  if (body.entry) {
    for (const entry of body.entry) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const comment = change.value;

        // 忽略非评论或非访客留言
        if (!comment || comment.item !== 'comment' || comment.verb !== 'add') continue;
        if (comment.from?.id === PAGE_ID) continue;

        const commentId = comment.comment_id;
        const message = comment.message || '';
        const postId = comment.post_id;

        // 判重：检查是否处理过
        const { data: existing, error } = await supabase
          .from('faq_handled_comments')
          .select('comment_id')
          .eq('comment_id', commentId)
          .maybeSingle();

        if (existing) continue; // 已处理，跳过

        // 发送到 Make Webhook
        await fetch(MAKE_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment_id: commentId, message, post_id: postId }),
        });

        // 写入数据库
        await supabase.from('faq_handled_comments').insert({ comment_id: commentId });
      }
    }
  }

  res.status(200).send('OK');
};
