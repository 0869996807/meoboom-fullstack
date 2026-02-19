<?php
require_once __DIR__ . "/utils.php";
$data = body_json();
$roomId = need($data, "room_id");
$mid = uid("m_");
q($pdo, "INSERT INTO matches(id,room_id) VALUES(:id,:r)", [":id"=>$mid,":r"=>$roomId]);
q($pdo, "UPDATE rooms SET status='playing', updated_at=now() WHERE id=:id", [":id"=>$roomId]);
log_event($pdo, $roomId, "match_start", null, "Bắt đầu ván");
ok(["match_id"=>$mid]);
