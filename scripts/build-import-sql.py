#!/usr/bin/env python3
"""Build a Supabase import SQL from exported CSVs (Paso 6)."""

from __future__ import annotations

import csv
import json
from pathlib import Path

DESKTOP = Path(
    r"c:\Users\brise\OneDrive\Obsoletos\archivos\Escritorio9nov19\Escritorio2\Escritorio"
)
OUT = Path(r"c:\Users\brise\micava\supabase\migrations\015_import_from_old_csv.sql")

FILES = {
    "profiles": DESKTOP / "Supabase Snippet Untitled query.csv",
    "cellars": DESKTOP / "Supabase Snippet Untitled query (1).csv",
    "wines": DESKTOP / "Supabase Snippet Untitled query (2).csv",
    "users": DESKTOP / "Supabase Snippet Untitled query (3).csv",
}


def sql_str(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def sql_nullish(value: str | None) -> str:
    if value is None:
        return "null"
    v = value.strip()
    if v == "" or v.lower() == "null":
        return "null"
    return sql_str(v)


def sql_text_required(value: str | None, default: str = "") -> str:
    """NOT NULL text columns: never emit SQL null."""
    if value is None:
        return sql_str(default)
    v = value.strip()
    if v == "" or v.lower() == "null":
        return sql_str(default)
    return sql_str(v)


def sql_bool(value: str | None) -> str:
    if value is None or value.strip().lower() in ("", "null"):
        return "false"
    return "true" if value.strip().lower() in ("true", "t", "1", "yes") else "false"


def sql_num(value: str | None) -> str:
    if value is None:
        return "null"
    v = value.strip()
    if v == "" or v.lower() == "null":
        return "null"
    return v


def sql_ts(value: str | None) -> str:
    return sql_nullish(value)


def sql_jsonb_raw(value: str) -> str:
    parsed = json.loads(value)
    dumped = json.dumps(parsed, ensure_ascii=False)
    return sql_str(dumped) + "::jsonb"


def sql_text_array(value: str | None) -> str:
    if value is None:
        return "null"
    v = value.strip()
    if v == "" or v.lower() == "null":
        return "null"
    if v.startswith("["):
        arr = json.loads(v)
        if not arr:
            return "'{}'::text[]"
        inner = ",".join(sql_str(str(x)) for x in arr)
        return f"ARRAY[{inner}]::text[]"
    return sql_str(v) + "::text[]"


def read_csv(path: Path) -> list[dict[str, str]]:
    for enc in ("utf-8-sig", "utf-8", "cp1252"):
        try:
            with path.open(newline="", encoding=enc) as f:
                return list(csv.DictReader(f))
        except UnicodeDecodeError:
            continue
    raise RuntimeError(f"Cannot decode {path}")


def provider_from_meta(meta: str | None) -> str:
    if not meta or meta.lower() == "null":
        return "email"
    try:
        data = json.loads(meta)
    except json.JSONDecodeError:
        return "email"
    if data.get("iss") == "https://accounts.google.com" or (
        data.get("provider_id") and data.get("picture")
    ):
        return "google"
    return "email"


def main() -> None:
    users = read_csv(FILES["users"])
    profiles = read_csv(FILES["profiles"])
    cellars = read_csv(FILES["cellars"])
    wines = read_csv(FILES["wines"])

    out: list[str] = [
        "-- Import from old micava CSVs (Paso 6)",
        "-- Run in the NEW Supabase project SQL Editor AFTER schema migrations.",
        "-- Note: cannot disable auth.users triggers (not table owner); we clean",
        "-- auto-created Principal cellars before inserting real ones.",
        "begin;",
        "",
        "-- 1) auth.users + identities",
    ]

    for u in users:
        meta = u.get("raw_user_meta_data")
        provider = provider_from_meta(meta)
        app_meta = json.dumps(
            {"provider": provider, "providers": [provider]}, ensure_ascii=False
        )
        meta_sql = (
            sql_jsonb_raw(meta)
            if meta and meta.strip().lower() != "null"
            else sql_str(json.dumps({"sub": u["id"], "email": u["email"]})) + "::jsonb"
        )

        out.append(
            f"""
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  is_sso_user, is_anonymous
) values (
  '00000000-0000-0000-0000-000000000000',
  {sql_str(u['id'])}::uuid,
  'authenticated',
  'authenticated',
  {sql_str(u['email'])},
  {sql_nullish(u.get('encrypted_password'))},
  {sql_ts(u.get('email_confirmed_at'))},
  {sql_ts(u.get('last_sign_in_at'))},
  {sql_str(app_meta)}::jsonb,
  {meta_sql},
  {sql_ts(u.get('created_at'))},
  {sql_ts(u.get('created_at'))},
  '', '', '', '',
  false, false
)
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = coalesce(excluded.encrypted_password, auth.users.encrypted_password),
  email_confirmed_at = coalesce(excluded.email_confirmed_at, auth.users.email_confirmed_at),
  raw_user_meta_data = excluded.raw_user_meta_data,
  raw_app_meta_data = excluded.raw_app_meta_data,
  last_sign_in_at = coalesce(excluded.last_sign_in_at, auth.users.last_sign_in_at),
  updated_at = now();
""".strip()
        )

        if meta and meta.strip().lower() != "null":
            m = json.loads(meta)
            provider_id = str(m.get("provider_id") or m.get("sub") or u["id"])
            identity_sql = sql_jsonb_raw(meta)
        else:
            provider_id = u["id"]
            identity_sql = (
                sql_str(json.dumps({"sub": u["id"], "email": u["email"]})) + "::jsonb"
            )

        out.append(
            f"""
delete from auth.identities
where user_id = {sql_str(u['id'])}::uuid and provider = {sql_str(provider)};

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  {sql_str(u['id'])}::uuid,
  {identity_sql},
  {sql_str(provider)},
  {sql_str(provider_id)},
  {sql_ts(u.get('last_sign_in_at'))},
  {sql_ts(u.get('created_at'))},
  {sql_ts(u.get('created_at'))}
);
""".strip()
        )

    out.append("")
    out.append("-- 2) public.profiles")
    for p in profiles:
        out.append(
            f"""
insert into public.profiles (
  id, display_name, bottle_pledge, created_at, network_visible,
  country, city, bio, network_updated_at, cava_public, public_handle
) values (
  {sql_str(p['id'])}::uuid,
  {sql_nullish(p.get('display_name'))},
  {sql_bool(p.get('bottle_pledge'))},
  {sql_ts(p.get('created_at'))},
  {sql_bool(p.get('network_visible'))},
  {sql_nullish(p.get('country'))},
  {sql_nullish(p.get('city'))},
  {sql_nullish(p.get('bio'))},
  {sql_ts(p.get('network_updated_at'))},
  {sql_bool(p.get('cava_public'))},
  {sql_nullish(p.get('public_handle'))}
)
on conflict (id) do update set
  display_name = excluded.display_name,
  bottle_pledge = excluded.bottle_pledge,
  network_visible = excluded.network_visible,
  country = excluded.country,
  city = excluded.city,
  bio = excluded.bio,
  network_updated_at = excluded.network_updated_at,
  cava_public = excluded.cava_public,
  public_handle = excluded.public_handle;
""".strip()
        )

    user_ids = [sql_str(u["id"]) + "::uuid" for u in users]
    cellar_ids = [sql_str(c["id"]) + "::uuid" for c in cellars]
    out.append("")
    out.append(
        "-- Remove empty Principals created by handle_new_user trigger"
    )
    out.append(
        f"delete from public.cellars\n"
        f"where user_id in ({', '.join(user_ids)})\n"
        f"  and id not in ({', '.join(cellar_ids)});"
    )

    out.append("")
    out.append("-- 3) public.cellars")
    for c in cellars:
        out.append(
            f"""
insert into public.cellars (
  id, user_id, name, cols, rows, sort_order, created_at
) values (
  {sql_str(c['id'])}::uuid,
  {sql_str(c['user_id'])}::uuid,
  {sql_str(c.get('name') or 'Principal')},
  {sql_num(c.get('cols'))}::integer,
  {sql_text_array(c.get('rows'))},
  {sql_num(c.get('sort_order'))}::integer,
  {sql_ts(c.get('created_at'))}
)
on conflict (id) do update set
  name = excluded.name,
  cols = excluded.cols,
  rows = excluded.rows,
  sort_order = excluded.sort_order;
""".strip()
        )

    wine_cols = [
        "id",
        "user_id",
        "slot",
        "col",
        "row",
        "country",
        "region",
        "type",
        "winery",
        "name",
        "aging",
        "grape",
        "vintage",
        "vivino",
        "price",
        "external_rating",
        "rating_source",
        "last_checked_at",
        "match_confidence",
        "created_at",
        "updated_at",
        "cellar_id",
        "kimi_vivino",
        "kimi_price",
        "kimi_summary",
        "kimi_checked_at",
        "kimi_confidence",
        "label_image_url",
        "kimi_curiosity",
        "kimi_talk_hook",
        "kimi_pairings",
        "cavatale_rating",
        "kimi_user_note",
    ]
    nums = {
        "col",
        "vintage",
        "vivino",
        "price",
        "external_rating",
        "kimi_vivino",
        "kimi_price",
        "cavatale_rating",
    }
    uuids = {"user_id", "cellar_id"}
    times = {"last_checked_at", "created_at", "updated_at", "kimi_checked_at"}
    required_text = {
        "country": "",
        "region": "",
        "type": "Tinto",
        "winery": "",
        "name": "",
        "aging": "",
        "grape": "",
    }

    out.append("")
    out.append("-- 4) public.wines")
    for w in wines:
        values: list[str] = []
        for col in wine_cols:
            raw = w.get(col)
            if col in uuids:
                values.append(
                    "null"
                    if not raw or str(raw).lower() == "null"
                    else f"{sql_str(raw)}::uuid"
                )
            elif col in times:
                values.append(sql_ts(raw))
            elif col in nums:
                values.append(sql_num(raw))
            elif col in required_text:
                values.append(sql_text_required(raw, required_text[col]))
            else:
                values.append(sql_nullish(raw))
        cols_sql = ", ".join(wine_cols)
        vals_sql = ",\n  ".join(values)
        out.append(
            f"""
insert into public.wines ({cols_sql})
values (
  {vals_sql}
)
on conflict (user_id, id) do update set
  slot = excluded.slot,
  col = excluded.col,
  row = excluded.row,
  country = excluded.country,
  region = excluded.region,
  type = excluded.type,
  winery = excluded.winery,
  name = excluded.name,
  aging = excluded.aging,
  grape = excluded.grape,
  vintage = excluded.vintage,
  vivino = excluded.vivino,
  price = excluded.price,
  cellar_id = excluded.cellar_id,
  kimi_vivino = excluded.kimi_vivino,
  kimi_price = excluded.kimi_price,
  kimi_summary = excluded.kimi_summary,
  kimi_checked_at = excluded.kimi_checked_at,
  kimi_confidence = excluded.kimi_confidence,
  label_image_url = excluded.label_image_url,
  kimi_curiosity = excluded.kimi_curiosity,
  kimi_talk_hook = excluded.kimi_talk_hook,
  kimi_pairings = excluded.kimi_pairings,
  cavatale_rating = excluded.cavatale_rating,
  kimi_user_note = excluded.kimi_user_note,
  updated_at = excluded.updated_at;
""".strip()
        )

    out.extend(
        [
            "",
            "commit;",
            "",
            "-- select count(*) from auth.users;",
            "-- select count(*) from public.profiles;",
            "-- select count(*) from public.cellars;",
            "-- select count(*) from public.wines;",
        ]
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n\n".join(out) + "\n", encoding="utf-8")
    print(f"Wrote {OUT}")
    print(
        f"users={len(users)} profiles={len(profiles)} cellars={len(cellars)} wines={len(wines)}"
    )


if __name__ == "__main__":
    main()
