<?php
header('Content-Type: text/html; charset=utf-8');

// Nếu bạn có frontend riêng thì redirect về đó.
// Tạm thời: hiển thị link API để test
echo "<h2>Meoboom API is running ✅</h2>";
echo "<ul>";
echo "<li><a href='/api/rooms.php'>/api/rooms.php</a> (Room list)</li>";
echo "<li><a href='/api/ranking.php'>/api/ranking.php</a> (Ranking)</li>";
echo "<li><a href='/api/history.php'>/api/history.php</a> (History)</li>";
echo "</ul>";
