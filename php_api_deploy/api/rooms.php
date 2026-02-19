<?php
require_once __DIR__ . "/utils.php";
$st = q($pdo, "
  SELECT r.id, r.name, r.status, r.max_players, r.created_at, r.updated_at,
         (SELECT COUNT(*) FROM players p WHERE p.room_id=r.id) AS player_count
  FROM rooms r
  WHERE r.status <> 'closed'
  ORDER BY r.updated_at DESC
  LIMIT 50
");
ok(["rooms"=>$st->fetchAll()]);
