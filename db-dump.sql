--
-- PostgreSQL database dump
--

-- Dumped from database version 14.18 (Homebrew)
-- Dumped by pg_dump version 14.18 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: menu_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_items (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    price numeric(10,2) NOT NULL,
    category character varying(100) NOT NULL,
    available boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    has_variants boolean DEFAULT false,
    half_price numeric(10,2),
    full_price numeric(10,2)
);


--
-- Name: menu_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.menu_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: menu_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.menu_items_id_seq OWNED BY public.menu_items.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer,
    menu_item_id integer,
    item_name character varying(255) NOT NULL,
    quantity integer NOT NULL,
    price numeric(10,2) NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    variant character varying(20)
);


--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    order_number character varying(50) NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    status character varying(20) DEFAULT 'pending'::character varying
);


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    key character varying(255) NOT NULL,
    value text NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'admin'::character varying,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: menu_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items ALTER COLUMN id SET DEFAULT nextval('public.menu_items_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: menu_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.menu_items (id, name, price, category, available, created_at, updated_at, has_variants, half_price, full_price) FROM stdin;
1	Paneer Tikka	220.00	Starters	t	2026-04-25 13:22:16.033422	2026-04-25 13:22:16.033422	f	\N	\N
2	Chicken 65	280.00	Starters	t	2026-04-25 13:22:16.034572	2026-04-25 13:22:16.034572	f	\N	\N
3	Veg Spring Roll	180.00	Starters	t	2026-04-25 13:22:16.035094	2026-04-25 13:22:16.035094	f	\N	\N
4	Fish Fry	320.00	Starters	t	2026-04-25 13:22:16.035475	2026-04-25 13:22:16.035475	f	\N	\N
5	Butter Chicken	350.00	Main Course	t	2026-04-25 13:22:16.035844	2026-04-25 13:22:16.035844	f	\N	\N
6	Paneer Butter Masala	280.00	Main Course	t	2026-04-25 13:22:16.036349	2026-04-25 13:22:16.036349	f	\N	\N
7	Dal Makhani	220.00	Main Course	t	2026-04-25 13:22:16.036897	2026-04-25 13:22:16.036897	f	\N	\N
8	Biryani (Chicken)	300.00	Main Course	t	2026-04-25 13:22:16.037427	2026-04-25 13:22:16.037427	f	\N	\N
9	Biryani (Veg)	240.00	Main Course	t	2026-04-25 13:22:16.038179	2026-04-25 13:22:16.038179	f	\N	\N
10	Chole Bhature	180.00	Main Course	t	2026-04-25 13:22:16.038631	2026-04-25 13:22:16.038631	f	\N	\N
11	Butter Naan	60.00	Breads	t	2026-04-25 13:22:16.039053	2026-04-25 13:22:16.039053	f	\N	\N
12	Garlic Naan	70.00	Breads	t	2026-04-25 13:22:16.039504	2026-04-25 13:22:16.039504	f	\N	\N
13	Roti	30.00	Breads	t	2026-04-25 13:22:16.039973	2026-04-25 13:22:16.039973	f	\N	\N
14	Paratha	50.00	Breads	t	2026-04-25 13:22:16.040635	2026-04-25 13:22:16.040635	f	\N	\N
15	Masala Chai	40.00	Beverages	t	2026-04-25 13:22:16.041141	2026-04-25 13:22:16.041141	f	\N	\N
16	Cold Coffee	120.00	Beverages	t	2026-04-25 13:22:16.04162	2026-04-25 13:22:16.04162	f	\N	\N
17	Fresh Lime Soda	80.00	Beverages	t	2026-04-25 13:22:16.042053	2026-04-25 13:22:16.042053	f	\N	\N
18	Lassi (Sweet)	90.00	Beverages	t	2026-04-25 13:22:16.04248	2026-04-25 13:22:16.04248	f	\N	\N
19	Mango Shake	130.00	Beverages	t	2026-04-25 13:22:16.042897	2026-04-25 13:22:16.042897	f	\N	\N
20	Gulab Jamun	80.00	Desserts	t	2026-04-25 13:22:16.04315	2026-04-25 13:22:16.04315	f	\N	\N
21	Rasmalai	100.00	Desserts	t	2026-04-25 13:22:16.043346	2026-04-25 13:22:16.043346	f	\N	\N
22	Ice Cream	120.00	Desserts	t	2026-04-25 13:22:16.043564	2026-04-25 13:22:16.043564	f	\N	\N
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.order_items (id, order_id, menu_item_id, item_name, quantity, price, subtotal, variant) FROM stdin;
1	1	19	Mango Shake	1	130.00	130.00	\N
2	2	16	Cold Coffee	1	120.00	120.00	\N
3	2	18	Lassi (Sweet)	1	90.00	90.00	\N
4	2	19	Mango Shake	1	130.00	130.00	\N
5	2	14	Paratha	1	50.00	50.00	\N
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orders (id, order_number, total_amount, created_at, status) FROM stdin;
1	ORD-20260425-0001	130.00	2026-04-25 13:25:35.681099	pending
2	ORD-20260425-0002	390.00	2026-04-25 13:26:45.217122	pending
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.settings (key, value, updated_at) FROM stdin;
settlement_password	$2a$12$uPfCIrVbIwI1e84KS8/SCOutPGi1Af72cehpIgEKltM8iT6x4HJc.	2026-05-06 18:11:42.775132
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, username, password_hash, role, created_at) FROM stdin;
1	admin	$2a$12$4VQwX3LbKpQhW/aIVnzVkOYg3tmG/9618dlFybsxx3TmQdaVG/hz2	admin	2026-04-25 13:22:16.020257
2	chef	$2a$12$e4hBCd48HO0H0RyOx2KFeucGRbydrYPAtwFT9R3Ib2y924uFZjcAi	chef	2026-04-26 01:07:33.798083
\.


--
-- Name: menu_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.menu_items_id_seq', 22, true);


--
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.order_items_id_seq', 5, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.orders_id_seq', 2, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 2, true);


--
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_menu_items_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_items_category ON public.menu_items USING btree (category);


--
-- Name: idx_order_items_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);


--
-- Name: idx_orders_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at);


--
-- Name: order_items order_items_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id);


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

