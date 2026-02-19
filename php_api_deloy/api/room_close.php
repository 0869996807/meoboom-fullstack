<?php
require_once __DIR__ . "/config.php";
$in = body_json();
$code = strtoupper(trim($in["room_code"] ?? ""));
if ($code === "") { http_response_code(400); echo json_encode(["error"=>"missing room_code"]); exit; }
$pdo->prepare("UPDATE rooms SET status='closed', updated_at=NOW() WHERE room_code=:c")->execute([":c"=>$code]);
echo json_encode(["ok"=>true]);
