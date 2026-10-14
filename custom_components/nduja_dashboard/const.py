"""Costanti di 'Nduja Dashboard."""
DOMAIN = "nduja_dashboard"
VERSION = "0.7.9-beta"
PANEL_URL = "nduja"
STATIC_URL = f"/{DOMAIN}_static"

CONF_TITLE = "sidebar_title"
CONF_ICON = "sidebar_icon"
CONF_ADMIN = "require_admin"
DEFAULT_TITLE = "'Nduja"
DEFAULT_ICON = "mdi:chili-hot"

# entità opzionali per la pagina Energia (se vuote, la plancia prova a trovarle da sola)
ENERGY_KEYS = (
    "pv_power", "grid_power", "home_power", "battery_power", "battery_soc",
    "pv_today", "grid_import_today", "grid_export_today", "home_today",
)
