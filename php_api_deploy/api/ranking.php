<?php
require_once __DIR__ . "/utils.php";
$rows = q($pdo, "SELECT player_name,wins,losses,(wins-losses) AS score, updated_at
                 FROM ranking ORDER BY score DESC, wins DESC, losses ASC LIMIT 50")->fetchAll();
ok(["ranking"=>$rows]);
