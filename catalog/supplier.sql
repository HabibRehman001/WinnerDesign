-- Supplier database contract for Winner Design catalogs.
-- Export these tables to the JSON shape accepted by the catalog importer
-- (format "winner-catalog-1"): one supplier row, eight price groups, and the item list.

CREATE TABLE supplier (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('GBP', 'EUR', 'USD')),
  discount REAL NOT NULL DEFAULT 0,
  margin REAL NOT NULL DEFAULT 0
);

CREATE TABLE price_group (
  supplier_id TEXT NOT NULL REFERENCES supplier(id),
  group_no INTEGER NOT NULL CHECK (group_no BETWEEN 1 AND 8),
  multiplier REAL NOT NULL,
  PRIMARY KEY (supplier_id, group_no)
);

CREATE TABLE catalog_item (
  sku TEXT NOT NULL,
  supplier_id TEXT NOT NULL REFERENCES supplier(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  group_name TEXT NOT NULL,
  style TEXT NOT NULL,
  mount TEXT NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  depth REAL NOT NULL,
  min_w REAL,
  max_w REAL,
  min_h REAL,
  max_h REAL,
  min_d REAL,
  max_d REAL,
  price REAL NOT NULL,
  door_count INTEGER NOT NULL DEFAULT 0,
  drawer_count INTEGER NOT NULL DEFAULT 0,
  elevation REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (supplier_id, sku)
);
