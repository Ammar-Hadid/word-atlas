SELECT json_build_object(
  'release',(SELECT json_build_object('id',r.id,'counts',r.counts) FROM dictionary_releases r JOIN sources s ON s.active_release_id=r.id),
  'entries',(SELECT count(*) FROM source_entries WHERE release_id=(SELECT active_release_id FROM sources WHERE id='wiktionary-en')),
  'saved',(SELECT count(*) FROM saved_entries),
  'history',(SELECT count(*) FROM search_history),
  'usage',(SELECT json_build_object('rows',count(*),'characters',coalesce(sum(characters),0)) FROM provider_usage),
  'audio',(SELECT json_agg(a ORDER BY a.asset_key) FROM (SELECT asset_key,checksum,byte_size FROM audio_assets WHERE status='ready') a),
  'fixture',(SELECT json_agg(f ORDER BY f.username) FROM (
    SELECT u.username,u.active,
      (SELECT json_agg(s ORDER BY s.term_key) FROM (SELECT term_key,entry_id,saved_at FROM saved_entries WHERE user_id=u.id) s) AS saves,
      (SELECT json_agg(h ORDER BY h.term_key) FROM (SELECT term_key,entry_id,first_visited_at,last_visited_at,visit_count FROM search_history WHERE user_id=u.id) h) AS history
    FROM users u WHERE u.username LIKE 'browser-backup-test-%'
  ) f)
);
