<?php
require_once __DIR__ . "/utils.php";
$data = body_json();
$roomId = need($data, "room_id");
$matchId = need($data, "match_id");
$winner = isset($data["winner_name"]) ? trim($data["winner_name"]) : null;
$loser  = isset($data["loser_name"]) ? trim($data["loser_name"]) : null;

q($pdo, "UPDATE matches SET ended_at=now(), winner_name=:w, loser_name=:l WHERE id=:id AND room_id=:r",
  [":w"=>$winner,":l"=>$loser,":id"=>$matchId,":r"=>$roomId]);
q($pdo, "UPDATE rooms SET status='open', updated_at=now() WHERE id=:id", [":id"=>$roomId]);

if ($winner) {
  q($pdo, "INSERT INTO ranking(player_name,wins,losses) VALUES(:p,1,0)
           ON CONFLICT(player_name) DO UPDATE SET wins=ranking.wins+1, updated_at=now()", [":p"=>$winner]);
}
if ($loser) {
  q($pdo, "INSERT INTO ranking(player_name,wins,losses) VALUES(:p,0,1)
           ON CONFLICT(player_name) DO UPDATE SET losses=ranking.losses+1, updated_at=now()", [":p"=>$loser]);
}
log_event($pdo, $roomId, "match_end", $winner, $winner ? ("Kết thúc ván. Thắng: ".$winner) : "Kết thúc ván");
ok([]);
