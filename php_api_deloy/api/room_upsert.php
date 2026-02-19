<?php
require_once __DIR__ . "/config.php";
$in = body_json();
$code = strtoupper(trim($in["room_code"] ?? ""));
$mode = trim($in["mode"] ?? "classic");
$status = trim($in["status"] ?? "open");
$players = intval($in["players_count"] ?? 0);
$started = intval($in["started"] ?? 0);
if ($code === "") { http_response_code(400); echo json_encode(["error"=>"missing room_code"]); exit; }

$stmt = $pdo->prepare("INSERT INTO rooms(room_code, mode, status, players_count, started, updated_at)
  VALUES(:c,:m,:s,:p,:st,NOW())
  ON CONFLICT(room_code) DO UPDATE SET mode=EXCLUDED.mode, status=EXCLUDED.status, players_count=EXCLUDED.players_count, started=EXCLUDED.started, updated_at=NOW()");
$stmt->execute([":c"=>$code, ":m"=>$mode, ":s"=>$status, ":p"=>$players, ":st"=>$started]);
echo json_encode(["ok"=>true]);
