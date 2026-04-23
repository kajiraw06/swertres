-- =============================================
--  SWERTRES 3D LOTTO — SUPABASE / POSTGRESQL SCHEMA
--  Run this in your Supabase SQL Editor:
--  Dashboard > SQL Editor > New Query > Paste > Run
-- =============================================

-- Tables

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  username    VARCHAR(50)   NOT NULL UNIQUE,
  phone       VARCHAR(20)   UNIQUE,
  email       VARCHAR(150)  UNIQUE,
  password    VARCHAR(255)  NOT NULL,
  balance     NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  role        TEXT          NOT NULL DEFAULT 'bettor' CHECK (role IN ('bettor','admin')),
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Run this once on existing databases to add the username column:
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;
-- UPDATE users SET username = phone WHERE username IS NULL;
-- ALTER TABLE users ALTER COLUMN username SET NOT NULL;

CREATE TABLE IF NOT EXISTS draws (
  id              SERIAL PRIMARY KEY,
  draw_date       DATE          NOT NULL,
  draw_time       TEXT          NOT NULL CHECK (draw_time IN ('2PM','5PM','9PM')),
  winning_numbers VARCHAR(10)   NOT NULL,
  jackpot         NUMERIC(10,2) NOT NULL DEFAULT 4500.00,
  winners_count   INTEGER DEFAULT 0,
  fetched_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (draw_date, draw_time)
);

CREATE TABLE IF NOT EXISTS bets (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  draw_date    DATE          NOT NULL,
  draw_time    TEXT          NOT NULL CHECK (draw_time IN ('2PM','5PM','9PM')),
  numbers      VARCHAR(10)   NOT NULL,
  bet_type     TEXT          NOT NULL DEFAULT 'straight' CHECK (bet_type IN ('straight','rambolito')),
  amount       NUMERIC(10,2) NOT NULL,
  status       TEXT          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','won','lost','cancelled')),
  prize_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type           TEXT          NOT NULL CHECK (type IN ('deposit','withdrawal','bet','prize','refund')),
  amount         NUMERIC(12,2) NOT NULL,
  balance_before NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  balance_after  NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  reference      VARCHAR(100),
  note           VARCHAR(255),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id INTEGER       REFERENCES transactions(id) ON DELETE SET NULL,
  paymongo_id    VARCHAR(100)  UNIQUE,
  amount         NUMERIC(12,2) NOT NULL,
  status         TEXT          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','expired')),
  checkout_url   TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bet_limits (
  id          SERIAL PRIMARY KEY,
  draw_time   TEXT          NOT NULL CHECK (draw_time IN ('2PM','5PM','9PM')),
  numbers     VARCHAR(10)   NOT NULL,
  max_amount  NUMERIC(10,2) NOT NULL DEFAULT 500.00,
  is_blocked  BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (draw_time, numbers)
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount       NUMERIC(12,2) NOT NULL,
  gcash_number VARCHAR(20)   NOT NULL,
  gcash_name   VARCHAR(100)  NOT NULL,
  status       TEXT          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  note         VARCHAR(255),
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bets_user         ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_draw         ON bets(draw_date, draw_time, status);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user     ON payments(user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS users_updated_at    ON users;
DROP TRIGGER IF EXISTS payments_updated_at ON payments;
CREATE TRIGGER users_updated_at    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RPC: place_bet
CREATE OR REPLACE FUNCTION place_bet(p_user_id INTEGER, p_draw_date DATE, p_draw_time TEXT, p_numbers TEXT, p_bet_type TEXT, p_amount NUMERIC)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_balance NUMERIC; v_bet_id INTEGER; v_new_balance NUMERIC;
BEGIN
  SELECT balance INTO v_balance FROM users WHERE id = p_user_id FOR UPDATE;
  IF v_balance IS NULL THEN RETURN jsonb_build_object('error', 'User not found'); END IF;
  IF v_balance < p_amount THEN RETURN jsonb_build_object('error', 'Insufficient balance'); END IF;
  v_new_balance := v_balance - p_amount;
  UPDATE users SET balance = v_new_balance WHERE id = p_user_id;
  INSERT INTO bets (user_id, draw_date, draw_time, numbers, bet_type, amount, status)
    VALUES (p_user_id, p_draw_date, p_draw_time, p_numbers, p_bet_type, p_amount, 'pending') RETURNING id INTO v_bet_id;
  INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, reference, note)
    VALUES (p_user_id, 'bet', p_amount, v_balance, v_new_balance, 'BET-' || v_bet_id,
            'Bet ' || p_numbers || ' (' || p_bet_type || ') for ' || p_draw_time || ' draw on ' || p_draw_date);
  RETURN jsonb_build_object('success', true, 'bet_id', v_bet_id, 'new_balance', v_new_balance);
END;
$$;

-- RPC: award_prize
CREATE OR REPLACE FUNCTION award_prize(p_bet_id INTEGER, p_prize_amount NUMERIC)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_user_id INTEGER; v_balance NUMERIC; v_draw_date DATE; v_draw_time TEXT; v_numbers TEXT; v_bet_type TEXT;
BEGIN
  SELECT user_id, draw_date, draw_time, numbers, bet_type INTO v_user_id, v_draw_date, v_draw_time, v_numbers, v_bet_type FROM bets WHERE id = p_bet_id;
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('error', 'Bet not found'); END IF;
  UPDATE bets SET status = 'won', prize_amount = p_prize_amount WHERE id = p_bet_id;
  SELECT balance INTO v_balance FROM users WHERE id = v_user_id FOR UPDATE;
  UPDATE users SET balance = balance + p_prize_amount WHERE id = v_user_id;
  INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, reference, note)
    VALUES (v_user_id, 'prize', p_prize_amount, v_balance, v_balance + p_prize_amount, 'BET-' || p_bet_id,
            'Won ' || v_draw_time || ' draw on ' || v_draw_date || ' — ' || v_numbers || ' (' || v_bet_type || ')');
  RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'prize', p_prize_amount);
END;
$$;

-- RPC: credit_user_balance
CREATE OR REPLACE FUNCTION credit_user_balance(p_user_id INTEGER, p_amount NUMERIC, p_note TEXT DEFAULT 'Manual credit by admin')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_balance NUMERIC;
BEGIN
  SELECT balance INTO v_balance FROM users WHERE id = p_user_id FOR UPDATE;
  IF v_balance IS NULL THEN RETURN jsonb_build_object('error', 'User not found'); END IF;
  UPDATE users SET balance = balance + p_amount WHERE id = p_user_id;
  INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, note)
    VALUES (p_user_id, 'deposit', p_amount, v_balance, v_balance + p_amount, p_note);
  RETURN jsonb_build_object('success', true, 'new_balance', v_balance + p_amount);
END;
$$;

-- RPC: confirm_deposit
CREATE OR REPLACE FUNCTION confirm_deposit(p_payment_id INTEGER, p_transaction_id INTEGER, p_user_id INTEGER, p_amount NUMERIC)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_balance NUMERIC;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM payments WHERE id = p_payment_id AND status = 'pending') THEN
    RETURN jsonb_build_object('error', 'Payment already processed');
  END IF;
  SELECT balance INTO v_balance FROM users WHERE id = p_user_id FOR UPDATE;
  UPDATE users        SET balance       = balance + p_amount         WHERE id = p_user_id;
  UPDATE transactions SET balance_after = v_balance + p_amount       WHERE id = p_transaction_id;
  UPDATE payments     SET status = 'paid', updated_at = NOW()        WHERE id = p_payment_id;
  RETURN jsonb_build_object('success', true, 'new_balance', v_balance + p_amount);
END;
$$;
