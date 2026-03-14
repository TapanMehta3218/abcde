from fastapi import FastAPI
from app.api.v1 import auth, products, warehouses, receipts, deliveries, transfers, adjustments, ledger, dashboard
from app.db.session import engine, Base

# create tables (simple approach for prototype)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="CoreInventory API")

# include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(products.router, prefix="/api/v1/products", tags=["products"])
app.include_router(warehouses.router, prefix="/api/v1/warehouses", tags=["warehouses"])
app.include_router(receipts.router, prefix="/api/v1/receipts", tags=["receipts"])
app.include_router(deliveries.router, prefix="/api/v1/deliveries", tags=["deliveries"])
app.include_router(transfers.router, prefix="/api/v1/transfers", tags=["transfers"])
app.include_router(adjustments.router, prefix="/api/v1/adjustments", tags=["adjustments"])
app.include_router(ledger.router, prefix="/api/v1/stock-ledger", tags=["ledger"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["dashboard"])

@app.get('/')
def root():
    return {"message":"CoreInventory API"}
