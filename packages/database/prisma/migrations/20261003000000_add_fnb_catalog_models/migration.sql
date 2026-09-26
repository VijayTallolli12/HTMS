-- F&B Catalog Management: Variants, Modifiers, Availability
-- Migration: 20261003000000_add_fnb_catalog_models

-- 1. Add availability column to existing fnb_menu_items table
ALTER TABLE "fnb_schema"."fnb_menu_items"
  ADD COLUMN IF NOT EXISTS "availability" VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE';

-- 2. Create fnb_menu_item_variants table
CREATE TABLE IF NOT EXISTS "fnb_schema"."fnb_menu_item_variants" (
  "id"            TEXT NOT NULL,
  "property_id"   TEXT NOT NULL,
  "menu_item_id"  TEXT NOT NULL,
  "code"          VARCHAR(50) NOT NULL,
  "name"          VARCHAR(100) NOT NULL,
  "price"         DECIMAL(12, 2) NOT NULL,
  "currency"      VARCHAR(3) NOT NULL DEFAULT 'JPY',
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "is_active"     BOOLEAN NOT NULL DEFAULT true,
  "created_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "fnb_menu_item_variants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fnb_menu_item_variants_menu_item_fkey" FOREIGN KEY ("menu_item_id")
    REFERENCES "fnb_schema"."fnb_menu_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "uq_fnb_variant_item_code" UNIQUE ("menu_item_id", "code")
);

CREATE INDEX IF NOT EXISTS "idx_fnb_variants_item_display"
  ON "fnb_schema"."fnb_menu_item_variants" ("menu_item_id", "display_order");

-- 3. Create fnb_modifier_groups table
CREATE TABLE IF NOT EXISTS "fnb_schema"."fnb_modifier_groups" (
  "id"             TEXT NOT NULL,
  "property_id"    TEXT NOT NULL,
  "menu_item_id"   TEXT NOT NULL,
  "name"           VARCHAR(100) NOT NULL,
  "selection_type" VARCHAR(20) NOT NULL DEFAULT 'MULTIPLE',
  "min_selections" INTEGER NOT NULL DEFAULT 0,
  "max_selections" INTEGER NOT NULL DEFAULT 5,
  "is_active"      BOOLEAN NOT NULL DEFAULT true,
  "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "fnb_modifier_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fnb_modifier_groups_menu_item_fkey" FOREIGN KEY ("menu_item_id")
    REFERENCES "fnb_schema"."fnb_menu_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "uq_fnb_mod_group_item_name" UNIQUE ("menu_item_id", "name")
);

-- 4. Create fnb_modifiers table
CREATE TABLE IF NOT EXISTS "fnb_schema"."fnb_modifiers" (
  "id"                TEXT NOT NULL,
  "property_id"       TEXT NOT NULL,
  "modifier_group_id" TEXT NOT NULL,
  "name"              VARCHAR(100) NOT NULL,
  "price_adjustment"  DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "currency"          VARCHAR(3) NOT NULL DEFAULT 'JPY',
  "is_active"         BOOLEAN NOT NULL DEFAULT true,
  "created_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "fnb_modifiers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fnb_modifiers_group_fkey" FOREIGN KEY ("modifier_group_id")
    REFERENCES "fnb_schema"."fnb_modifier_groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

