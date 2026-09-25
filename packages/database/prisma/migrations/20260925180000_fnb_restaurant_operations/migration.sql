-- CreateSchema
CREATE SCHEMA IF NOT EXISTS fnb_schema;

-- CreateTable fnb_outlets
CREATE TABLE IF NOT EXISTS fnb_schema.fnb_outlets (
    id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    outlet_type VARCHAR(50) NOT NULL DEFAULT 'RESTAURANT',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ(6),

    CONSTRAINT pk_fnb_outlets PRIMARY KEY (id),
    CONSTRAINT uq_fnb_outlet_property_code UNIQUE (property_id, code)
);

-- CreateTable fnb_menu_categories
CREATE TABLE IF NOT EXISTS fnb_schema.fnb_menu_categories (
    id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    outlet_id TEXT NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_fnb_menu_categories PRIMARY KEY (id),
    CONSTRAINT uq_fnb_menu_cat_outlet_code UNIQUE (outlet_id, code)
);

-- CreateTable fnb_menu_items
CREATE TABLE IF NOT EXISTS fnb_schema.fnb_menu_items (
    id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    outlet_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    price DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'JPY',
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_fnb_menu_items PRIMARY KEY (id),
    CONSTRAINT uq_fnb_menu_item_outlet_code UNIQUE (outlet_id, code)
);

-- CreateTable fnb_tables
CREATE TABLE IF NOT EXISTS fnb_schema.fnb_tables (
    id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    outlet_id TEXT NOT NULL,
    table_number VARCHAR(20) NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 4,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    active_order_id TEXT,
    version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_fnb_tables PRIMARY KEY (id),
    CONSTRAINT uq_fnb_table_outlet_number UNIQUE (outlet_id, table_number),
    CONSTRAINT uq_fnb_table_active_order UNIQUE (active_order_id)
);

-- CreateTable fnb_orders
CREATE TABLE IF NOT EXISTS fnb_schema.fnb_orders (
    id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    outlet_id TEXT NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    table_id TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    guest_count INTEGER NOT NULL DEFAULT 1,
    server_name VARCHAR(100),
    notes VARCHAR(500),
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'JPY',
    settlement_type VARCHAR(30) NOT NULL DEFAULT 'ROOM_CHARGE',
    payment_method VARCHAR(30),
    reservation_id TEXT,
    folio_id TEXT,
    folio_transaction_id TEXT,
    room_number VARCHAR(20),
    guest_name VARCHAR(150),
    closed_at TIMESTAMPTZ(6),
    closed_by TEXT,
    version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_fnb_orders PRIMARY KEY (id),
    CONSTRAINT uq_fnb_order_property_number UNIQUE (property_id, order_number)
);

-- CreateTable fnb_order_items
CREATE TABLE IF NOT EXISTS fnb_schema.fnb_order_items (
    id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    menu_item_id TEXT NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    notes VARCHAR(200),
    status VARCHAR(20) NOT NULL DEFAULT 'ORDERED',
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_fnb_order_items PRIMARY KEY (id)
);

-- CreateIndexes
CREATE INDEX IF NOT EXISTS idx_fnb_outlets_property_status ON fnb_schema.fnb_outlets (property_id, status);
CREATE INDEX IF NOT EXISTS idx_fnb_menu_cat_display ON fnb_schema.fnb_menu_categories (outlet_id, display_order);
CREATE INDEX IF NOT EXISTS idx_fnb_menu_items_cat_display ON fnb_schema.fnb_menu_items (category_id, display_order);
CREATE INDEX IF NOT EXISTS idx_fnb_tables_outlet_status ON fnb_schema.fnb_tables (outlet_id, status);
CREATE INDEX IF NOT EXISTS idx_fnb_orders_prop_outlet_status ON fnb_schema.fnb_orders (property_id, outlet_id, status);
CREATE INDEX IF NOT EXISTS idx_fnb_orders_table ON fnb_schema.fnb_orders (table_id);
CREATE INDEX IF NOT EXISTS idx_fnb_orders_reservation ON fnb_schema.fnb_orders (reservation_id);
CREATE INDEX IF NOT EXISTS idx_fnb_order_items_order ON fnb_schema.fnb_order_items (order_id);

-- Foreign Keys
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fnb_outlet_property') THEN
        ALTER TABLE fnb_schema.fnb_outlets ADD CONSTRAINT fk_fnb_outlet_property FOREIGN KEY (property_id) REFERENCES platform_schema.properties(id) ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fnb_menu_cat_outlet') THEN
        ALTER TABLE fnb_schema.fnb_menu_categories ADD CONSTRAINT fk_fnb_menu_cat_outlet FOREIGN KEY (outlet_id) REFERENCES fnb_schema.fnb_outlets(id) ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fnb_menu_item_outlet') THEN
        ALTER TABLE fnb_schema.fnb_menu_items ADD CONSTRAINT fk_fnb_menu_item_outlet FOREIGN KEY (outlet_id) REFERENCES fnb_schema.fnb_outlets(id) ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fnb_menu_item_category') THEN
        ALTER TABLE fnb_schema.fnb_menu_items ADD CONSTRAINT fk_fnb_menu_item_category FOREIGN KEY (category_id) REFERENCES fnb_schema.fnb_menu_categories(id) ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fnb_table_outlet') THEN
        ALTER TABLE fnb_schema.fnb_tables ADD CONSTRAINT fk_fnb_table_outlet FOREIGN KEY (outlet_id) REFERENCES fnb_schema.fnb_outlets(id) ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fnb_table_active_order') THEN
        ALTER TABLE fnb_schema.fnb_tables ADD CONSTRAINT fk_fnb_table_active_order FOREIGN KEY (active_order_id) REFERENCES fnb_schema.fnb_orders(id) ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fnb_order_outlet') THEN
        ALTER TABLE fnb_schema.fnb_orders ADD CONSTRAINT fk_fnb_order_outlet FOREIGN KEY (outlet_id) REFERENCES fnb_schema.fnb_outlets(id) ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fnb_order_table') THEN
        ALTER TABLE fnb_schema.fnb_orders ADD CONSTRAINT fk_fnb_order_table FOREIGN KEY (table_id) REFERENCES fnb_schema.fnb_tables(id) ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fnb_order_item_order') THEN
        ALTER TABLE fnb_schema.fnb_order_items ADD CONSTRAINT fk_fnb_order_item_order FOREIGN KEY (order_id) REFERENCES fnb_schema.fnb_orders(id) ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fnb_order_item_menu_item') THEN
        ALTER TABLE fnb_schema.fnb_order_items ADD CONSTRAINT fk_fnb_order_item_menu_item FOREIGN KEY (menu_item_id) REFERENCES fnb_schema.fnb_menu_items(id) ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

