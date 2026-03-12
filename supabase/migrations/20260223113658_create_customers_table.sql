/*
  # Create customers table for PayRisk AI

  1. New Tables
    - `customers`
      - `id` (uuid, primary key) - Unique identifier
      - `name` (text) - Customer name
      - `email` (text) - Customer email address
      - `company` (text) - Customer company name
      - `amount_owed` (decimal) - Outstanding amount
      - `due_date` (date) - Payment due date
      - `total_orders` (integer) - Total number of orders placed
      - `average_order_value` (decimal) - Average value per order
      - `last_purchase_date` (date) - Date of last purchase
      - `is_high_risk_industry` (boolean) - Manual flag for high-risk industry
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp
      - `user_id` (uuid) - Owner of the customer record

  2. Security
    - Enable RLS on `customers` table
    - Add policy for authenticated users to read their own customers
    - Add policy for authenticated users to insert their own customers
    - Add policy for authenticated users to update their own customers
    - Add policy for authenticated users to delete their own customers
*/

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  company text DEFAULT '',
  amount_owed decimal(10, 2) DEFAULT 0,
  due_date date,
  total_orders integer DEFAULT 0,
  average_order_value decimal(10, 2) DEFAULT 0,
  last_purchase_date date,
  is_high_risk_industry boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own customers"
  ON customers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own customers"
  ON customers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_due_date ON customers(due_date);
