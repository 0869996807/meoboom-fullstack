<?php
require_once __DIR__ . "/config.php";
$in = body_json();
$match_id = intval($in["match_id"] ?? 0);
$results = $in["results"] ?? [];
if ($match_id <= 0 || !is_array($results) || count($results) < 2) { http_response_code(400); echo json_encode(["error"=>"bad input"]); exit; }

$pdo->beginTransaction();
$pdo->prepare("UPDATE matches SET ended_at=NOW() WHERE id=:id")->execute([":id"=>$match_id]);

$updRes = $pdo->prepare("UPDATE match_players SET placement=:pl, exploded=:ex, delta=:d WHERE match_id=:mid AND player_token=:t");
$updPlayer = $pdo->prepare("UPDATE players SET rating = GREATEST(0, rating + :d),
  games = games + 1,
  wins = wins + :w,
  losses = losses + :l,
  updated_at = NOW()
  WHERE player_token=:t");

foreach ($results as $r) {
  $t = trim($r["player_token"] ?? "");
  $pl = intval($r["placement"] ?? 0);
  $ex = !empty($r["exploded"]);
  if ($t==="" || $pl<=0) continue;

  $delta = ($pl===1) ? 25 : -10;
  if ($ex) $delta -= 15;
  if ($pl<=3) $delta += 5;

  $updRes->execute([":pl"=>$pl, ":ex"=>$ex?1:0, ":d"=>$delta, ":mid"=>$match_id, ":t"=>$t]);

  $win = ($pl===1) ? 1 : 0;
  $loss = ($pl===1) ? 0 : 1;
  $updPlayer->execute([":d"=>$delta, ":w"=>$win, ":l"=>$loss, ":t"=>$t]);
}
$pdo->commit();
echo json_encode(["ok"=>true]);
