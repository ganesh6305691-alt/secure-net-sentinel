-- Insert sample security logs for demonstration
-- These will be assigned to the first user that signs up

DO $$
DECLARE
  demo_user_id UUID;
BEGIN
  -- Get the first user ID (or you can sign up first and this will use your account)
  SELECT id INTO demo_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
  
  -- Only insert if a user exists
  IF demo_user_id IS NOT NULL THEN
    -- Sample Log 1: Brute Force Attack
    INSERT INTO public.logs (user_id, filename, content, file_size, status, uploaded_at, analyzed_at)
    VALUES (
      demo_user_id,
      'ssh_auth_attempts.log',
      '2024-01-15 10:30:45 192.168.1.100 -> 10.0.0.50 port:22 SSH login attempt from user: admin
2024-01-15 10:30:46 192.168.1.100 -> 10.0.0.50 port:22 Failed authentication for admin
2024-01-15 10:30:47 192.168.1.100 -> 10.0.0.50 port:22 Failed authentication for admin
2024-01-15 10:30:48 192.168.1.100 -> 10.0.0.50 port:22 Failed authentication for root
2024-01-15 10:30:49 192.168.1.100 -> 10.0.0.50 port:22 Failed authentication for root
2024-01-15 10:30:50 192.168.1.100 -> 10.0.0.50 port:22 Failed authentication for user
2024-01-15 10:30:51 192.168.1.100 -> 10.0.0.50 port:22 Failed authentication for admin
2024-01-15 10:30:52 192.168.1.100 -> 10.0.0.50 port:22 Connection closed by 192.168.1.100',
      850,
      'pending',
      NOW() - INTERVAL '2 hours',
      NULL
    );

    -- Sample Log 2: DDoS Attack Pattern
    INSERT INTO public.logs (user_id, filename, content, file_size, status, uploaded_at, analyzed_at)
    VALUES (
      demo_user_id,
      'web_traffic.log',
      '2024-01-15 14:22:01 203.0.113.45 -> 10.0.0.80 port:80 GET /index.html HTTP/1.1
2024-01-15 14:22:01 203.0.113.46 -> 10.0.0.80 port:80 GET /index.html HTTP/1.1
2024-01-15 14:22:01 203.0.113.47 -> 10.0.0.80 port:80 GET /index.html HTTP/1.1
2024-01-15 14:22:01 203.0.113.48 -> 10.0.0.80 port:80 GET /index.html HTTP/1.1
2024-01-15 14:22:02 203.0.113.49 -> 10.0.0.80 port:80 GET /index.html HTTP/1.1
2024-01-15 14:22:02 203.0.113.50 -> 10.0.0.80 port:80 GET /index.html HTTP/1.1
2024-01-15 14:22:02 203.0.113.51 -> 10.0.0.80 port:80 GET /index.html HTTP/1.1
2024-01-15 14:22:02 203.0.113.52 -> 10.0.0.80 port:80 GET /index.html HTTP/1.1
2024-01-15 14:22:03 203.0.113.53 -> 10.0.0.80 port:80 GET /index.html HTTP/1.1
2024-01-15 14:22:03 203.0.113.54 -> 10.0.0.80 port:80 GET /index.html HTTP/1.1',
      950,
      'pending',
      NOW() - INTERVAL '1 hour',
      NULL
    );

    -- Sample Log 3: SQL Injection Attempt
    INSERT INTO public.logs (user_id, filename, content, file_size, status, uploaded_at, analyzed_at)
    VALUES (
      demo_user_id,
      'application_access.log',
      '2024-01-15 16:45:12 198.51.100.25 -> 10.0.0.80 port:443 GET /api/users?id=1 HTTP/1.1 200 OK
2024-01-15 16:45:45 198.51.100.25 -> 10.0.0.80 port:443 GET /api/users?id=1'' OR ''1''=''1 HTTP/1.1 500 Error
2024-01-15 16:45:50 198.51.100.25 -> 10.0.0.80 port:443 GET /api/users?id=1; DROP TABLE users-- HTTP/1.1 500 Error
2024-01-15 16:46:00 198.51.100.25 -> 10.0.0.80 port:443 GET /api/login?user=admin'' OR 1=1-- HTTP/1.1 403 Forbidden
2024-01-15 16:46:10 198.51.100.25 -> 10.0.0.80 port:443 POST /api/search body: {"query": "'' UNION SELECT * FROM passwords--"} HTTP/1.1 500 Error',
      720,
      'pending',
      NOW() - INTERVAL '30 minutes',
      NULL
    );

    -- Sample Log 4: Port Scanning Activity
    INSERT INTO public.logs (user_id, filename, content, file_size, status, uploaded_at, analyzed_at)
    VALUES (
      demo_user_id,
      'firewall_connections.log',
      '2024-01-15 18:10:01 172.16.0.99 -> 10.0.0.100 port:21 Connection attempt BLOCKED
2024-01-15 18:10:01 172.16.0.99 -> 10.0.0.100 port:22 Connection attempt BLOCKED
2024-01-15 18:10:01 172.16.0.99 -> 10.0.0.100 port:23 Connection attempt BLOCKED
2024-01-15 18:10:02 172.16.0.99 -> 10.0.0.100 port:25 Connection attempt BLOCKED
2024-01-15 18:10:02 172.16.0.99 -> 10.0.0.100 port:80 Connection attempt BLOCKED
2024-01-15 18:10:02 172.16.0.99 -> 10.0.0.100 port:443 Connection attempt BLOCKED
2024-01-15 18:10:03 172.16.0.99 -> 10.0.0.100 port:3306 Connection attempt BLOCKED
2024-01-15 18:10:03 172.16.0.99 -> 10.0.0.100 port:3389 Connection attempt BLOCKED
2024-01-15 18:10:03 172.16.0.99 -> 10.0.0.100 port:8080 Connection attempt BLOCKED',
      890,
      'pending',
      NOW() - INTERVAL '15 minutes',
      NULL
    );

    -- Sample Log 5: Normal Traffic (No Threats)
    INSERT INTO public.logs (user_id, filename, content, file_size, status, uploaded_at, analyzed_at)
    VALUES (
      demo_user_id,
      'normal_traffic.log',
      '2024-01-15 09:00:00 10.0.1.50 -> 10.0.0.80 port:443 GET /dashboard HTTP/1.1 200 OK
2024-01-15 09:00:15 10.0.1.51 -> 10.0.0.80 port:443 GET /api/data HTTP/1.1 200 OK
2024-01-15 09:00:30 10.0.1.52 -> 10.0.0.80 port:443 POST /api/save HTTP/1.1 201 Created
2024-01-15 09:00:45 10.0.1.50 -> 10.0.0.80 port:443 GET /profile HTTP/1.1 200 OK
2024-01-15 09:01:00 10.0.1.53 -> 10.0.0.80 port:443 GET /reports HTTP/1.1 200 OK',
      450,
      'pending',
      NOW() - INTERVAL '5 minutes',
      NULL
    );

    -- Sample Log 6: Malware Communication Pattern
    INSERT INTO public.logs (user_id, filename, content, file_size, status, uploaded_at, analyzed_at)
    VALUES (
      demo_user_id,
      'suspicious_outbound.log',
      '2024-01-15 20:30:00 10.0.1.75 -> 185.220.101.15 port:4444 Outbound connection established
2024-01-15 20:30:05 10.0.1.75 -> 185.220.101.15 port:4444 Data transmission: 2048 bytes
2024-01-15 20:30:10 10.0.1.75 -> 185.220.101.15 port:4444 Data transmission: 4096 bytes
2024-01-15 20:30:15 10.0.1.75 -> 185.220.101.15 port:4444 Receiving commands
2024-01-15 20:30:20 10.0.1.75 -> 185.220.101.15 port:4444 Suspicious encrypted payload detected
2024-01-15 20:30:25 10.0.1.75 -> 45.33.32.156 port:6667 IRC connection attempt
2024-01-15 20:30:30 10.0.1.75 -> 185.220.101.15 port:4444 Data exfiltration detected',
      780,
      'pending',
      NOW() - INTERVAL '10 minutes',
      NULL
    );

  END IF;
END $$;