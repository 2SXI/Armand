\set ON_ERROR_STOP off
\pset tuples_only on
\set owner '''00000000-0000-0000-0000-0000000000aa'''
\set alice '''00000000-0000-0000-0000-0000000000b1'''
\set bob   '''00000000-0000-0000-0000-0000000000b2'''
-- clean slate for orders
RESET ROLE; TRUNCATE orders RESTART IDENTITY; UPDATE products SET stock=10, price=5 WHERE id=1;

\echo T5  alice (logged in) places order -> total 5.00 expected
SET ROLE authenticated; SELECT set_config('request.uid', :alice, false) \gset
SELECT (place_order('Alice Moyo','+263781112222','addr','','EcoCash','[{"id":1,"qty":1}]'::jsonb))->>'total';
\echo T6  bob (logged in) places order
SELECT set_config('request.uid', :bob, false) \gset
SELECT (place_order('Bob Ncube','+263782223333','','','EcoCash','[{"id":1,"qty":1}]'::jsonb))->>'total';
\echo T7  guest (anon) places order - guest checkout must still work
RESET ROLE; SET ROLE anon; SELECT set_config('request.uid','',false) \gset
SELECT (place_order('Guest Gee','+263783334444','','','EcoCash','[{"id":1,"qty":1}]'::jsonb))->>'total';

RESET ROLE;
\echo     order ownership as stored:
SELECT '    #'||id||' '||customer_name||' -> '||coalesce(user_id::text,'(guest)') FROM orders ORDER BY id;

\echo T8  alice sees only HER orders (expect 1)
SET ROLE authenticated; SELECT set_config('request.uid', :alice, false) \gset
SELECT count(*) FROM orders;
\echo T9  bob sees only HIS orders (expect 1)
SELECT set_config('request.uid', :bob, false) \gset
SELECT count(*) FROM orders;
\echo T10 anon sees no orders (expect 0)
RESET ROLE; SET ROLE anon; SELECT count(*) FROM orders;
\echo T11 admin sees ALL orders (expect 3)
RESET ROLE; SET ROLE authenticated; SELECT set_config('request.uid', :owner, false) \gset
SELECT count(*) FROM orders;
\echo T12 alice cannot change order status (expect 0 rows updated)
SELECT set_config('request.uid', :alice, false) \gset
WITH u AS (UPDATE orders SET status='delivered' RETURNING id) SELECT count(*) FROM u;
\echo T12b alice cannot tamper with her order total either (expect 0)
WITH u AS (UPDATE orders SET total=0 WHERE user_id=auth.uid() RETURNING id) SELECT count(*) FROM u;
\echo T13 a customer cannot insert an order row directly (expect RLS error)
INSERT INTO orders (customer_name,total,user_id) VALUES ('x',1,:bob);

\echo T27 guest enquiry with good data accepted (expect INSERT 0 1)
RESET ROLE; SET ROLE anon; SELECT set_config('request.uid','',false) \gset
INSERT INTO enquiries (name,phone,email,message) VALUES ('Tom Z','0771234567','tom@x.com','hello there');
\echo T27b guest enquiry with no email accepted (email optional)
INSERT INTO enquiries (name,phone,message) VALUES ('Tom Z','0771234568','hello there');
\echo T26 bad email rejected (expect check-constraint error)
INSERT INTO enquiries (name,phone,email,message) VALUES ('Tom Z','0771234569','not-an-email','hello there');

\echo T29 bad order status rejected (expect check-constraint error)
RESET ROLE; SET ROLE authenticated; SELECT set_config('request.uid', :owner, false) \gset
UPDATE orders SET status='lol' WHERE id=1;
\echo T31 admin status flow: pending->confirmed->shipped->delivered
UPDATE orders SET status='confirmed' WHERE id=1;
UPDATE orders SET status='shipped' WHERE id=1;
UPDATE orders SET status='delivered' WHERE id=1 RETURNING status;
\echo T31b cancelling restores stock (stock before/after for order 2)
RESET ROLE; SELECT 'stock before: '||stock FROM products WHERE id=1;
SET ROLE authenticated; SELECT set_config('request.uid', :owner, false) \gset
UPDATE orders SET status='cancelled' WHERE id=2;
RESET ROLE; SELECT 'stock after:  '||stock FROM products WHERE id=1;
\echo T32 guest tracking by order number + phone still works (expect delivered)
SET ROLE anon; SELECT (track_order(1,'0781112222'))->>'status';
\echo T32b wrong phone returns nothing (expect empty)
SELECT coalesce((track_order(1,'0700000000'))->>'status','(nothing)');
\echo T33 customers cannot call is_admin to learn others' status; own check only
RESET ROLE; SET ROLE authenticated; SELECT set_config('request.uid', :alice, false) \gset
SELECT is_admin();
