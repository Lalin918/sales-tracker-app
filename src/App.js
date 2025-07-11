import { firebaseConfig } from './firebaseConfig';
import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    signInAnonymously, 
    onAuthStateChanged
} from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    doc, 
    deleteDoc,
    query,
    updateDoc,
    writeBatch,
    where,
    getDocs
} from 'firebase/firestore';

// --- Helper Functions ---
const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = date instanceof Date ? date : date.toDate();
    return new Intl.DateTimeFormat('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Bangkok'
    }).format(d);
};

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('th-TH', {
        style: 'currency',
        currency: 'THB',
    }).format(amount);
};

// --- Main UI Components ---
const Header = () => (
    <header className="bg-gray-800 text-white shadow-lg">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
                <div className="flex items-center">
                    <svg className="h-8 w-8 text-indigo-400 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4M4 7s0 0 0 0" />
                    </svg>
                    <h1 className="text-2xl font-bold">Sales & Inventory</h1>
                </div>
            </div>
        </div>
    </header>
);

const ViewSwitcher = ({ currentView, setCurrentView }) => {
    const views = [
        { key: 'sales', label: 'Sales Tracker' },
        { key: 'inventory', label: 'Inventory' },
        { key: 'branch', label: 'มุมมองสาขา' },
    ];
    const baseStyle = "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors focus:outline-none";
    const activeStyle = "bg-white text-indigo-600 border-b-2 border-indigo-600";
    const inactiveStyle = "text-gray-500 hover:text-gray-700";

    return (
        <nav className="border-b border-gray-200 -mt-px flex space-x-4">
            {views.map(view => (
                <button
                    key={view.key}
                    onClick={() => setCurrentView(view.key)}
                    className={`${baseStyle} ${currentView === view.key ? activeStyle : inactiveStyle}`}
                >
                    {view.label}
                </button>
            ))}
        </nav>
    );
};

const StatsCard = ({ title, value, icon }) => (
    <div className="bg-white rounded-xl shadow-md p-6 flex items-center space-x-4 transition-transform transform hover:scale-105">
        <div className="p-3 bg-indigo-100 rounded-full">{icon}</div>
        <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
    </div>
);

// --- Sales Components ---
const FilterControls = ({ yearFilter, setYearFilter, monthFilter, setMonthFilter }) => {
    const months = [
        "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
        "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    const years = [2025, 2024];

    const baseStyle = "px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500";
    const activeStyle = "bg-indigo-600 text-white shadow";
    const inactiveStyle = "bg-white text-gray-700 hover:bg-gray-100";

    const handleYearChange = (e) => {
        setYearFilter(e.target.value);
        setMonthFilter('all'); // Reset month when year changes
    };

    const handleMonthChange = (e) => {
        setMonthFilter(e.target.value);
    };
    
    const handleShowAll = () => {
        setYearFilter('all');
        setMonthFilter('all');
    };

    return (
        <div className="flex justify-center flex-wrap items-center gap-2 my-6">
            <select onChange={handleYearChange} value={yearFilter} className={`${baseStyle} border-gray-300 border`}>
                <option value="all">-- เลือกปี --</option>
                {years.map((year) => (<option key={year} value={year}>{`ปี ${year}`}</option>))}
            </select>
            <select onChange={handleMonthChange} value={monthFilter} disabled={yearFilter === 'all'} className={`${baseStyle} border-gray-300 border disabled:bg-gray-100 disabled:cursor-not-allowed`}>
                <option value="all">-- เลือกเดือน --</option>
                {months.map((month, index) => (<option key={index} value={index}>{month}</option>))}
            </select>
            <button onClick={handleShowAll} className={`${baseStyle} ${yearFilter === 'all' ? activeStyle : inactiveStyle}`}>ทั้งหมด</button>
        </div>
    );
};

const SalesStats = ({ sales }) => {
    const stats = useMemo(() => {
        const totalRevenue = sales.reduce((sum, sale) => sum + sale.amount, 0);
        const totalCost = sales.reduce((sum, sale) => sum + sale.cost, 0);
        const totalSales = sales.length;
        const averageSale = totalSales > 0 ? totalRevenue / totalSales : 0;
        const totalProfit = totalRevenue - totalCost;
        return { totalRevenue, totalSales, averageSale, totalProfit };
    }, [sales]);
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
            <StatsCard title="ยอดขายทั้งหมด" value={formatCurrency(stats.totalRevenue)} icon={<svg className="h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>} />
            <StatsCard title="กำไรทั้งหมด" value={formatCurrency(stats.totalProfit)} icon={<svg className="h-6 w-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} />
            <StatsCard title="จำนวนออเดอร์" value={stats.totalSales} icon={<svg className="h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} />
            <StatsCard title="ยอดขายเฉลี่ย" value={formatCurrency(stats.averageSale)} icon={<svg className="h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} />
        </div>
    );
};

const AddSaleForm = ({ db, userId, inventory, branches, branchInventory }) => {
    const [selectedBranchId, setSelectedBranchId] = useState('');
    const [selectedProductId, setSelectedProductId] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [unitPrice, setUnitPrice] = useState('');
    const [discount, setDiscount] = useState('');
    const [saleDate, setSaleDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const availableProducts = useMemo(() => {
        if (!selectedBranchId) return [];
        const branchProducts = branchInventory.filter(item => item.branchId === selectedBranchId);
        return branchProducts.map(bp => {
            const masterProduct = inventory.find(inv => inv.id === bp.productId);
            return { ...masterProduct, ...bp, branchInventoryId: bp.id }; // Add branchInventoryId
        });
    }, [selectedBranchId, branchInventory, inventory]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const selectedBranch = branches.find(b => b.id === selectedBranchId);
        const productInBranch = availableProducts.find(p => p.productId === selectedProductId);
        const saleDiscount = Number(discount) || 0;

        if (!selectedBranch || !productInBranch || !quantity || !unitPrice || !userId) {
            setError("กรุณากรอกข้อมูลให้ครบ: สาขา, สินค้า, จำนวน, และราคาขาย");
            return;
        }
        if (quantity > productInBranch.stock) {
            setError(`สินค้าไม่พอ! เหลือเพียง ${productInBranch.stock} ชิ้นในสาขานี้`);
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const dateToStore = saleDate ? new Date(saleDate + 'T00:00:00') : new Date();
            const batch = writeBatch(db);

            const salesCollection = collection(db, 'users', userId, 'sales');
            batch.set(doc(salesCollection), {
                product: productInBranch.name,
                productId: productInBranch.productId,
                branchId: selectedBranchId,
                branchName: selectedBranch.name,
                quantity: Number(quantity),
                unitPrice: Number(unitPrice),
                amount: (Number(unitPrice) * quantity) - saleDiscount,
                cost: productInBranch.cost * quantity,
                discount: saleDiscount,
                salesChannel: selectedBranch.name,
                date: dateToStore,
                userId
            });

            const branchInventoryDocRef = doc(db, 'users', userId, 'branchInventory', productInBranch.branchInventoryId);
            const newStock = productInBranch.stock - quantity;
            batch.update(branchInventoryDocRef, { stock: newStock });

            await batch.commit();

            setSelectedBranchId('');
            setSelectedProductId('');
            setQuantity(1);
            setUnitPrice('');
            setDiscount('');
            setSaleDate('');
        } catch (err) {
            console.error("Error processing sale: ", err);
            setError("เกิดข้อผิดพลาดในการบันทึกการขาย");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const productDetails = availableProducts.find(p => p.productId === selectedProductId);
    const totalAmount = unitPrice ? Number(unitPrice) * quantity : 0;
    const finalAmount = totalAmount - (Number(discount) || 0);

    return (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">เพิ่มรายการขายใหม่ (ตัดสต็อกตามสาขา)</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                     <div>
                        <label htmlFor="branch" className="block text-sm font-medium text-gray-700">สาขา/จุดขาย</label>
                        <select id="branch" value={selectedBranchId} onChange={(e) => { setSelectedBranchId(e.target.value); setSelectedProductId(''); }} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md">
                            <option value="">-- เลือกสาขา --</option>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                     <div className="lg:col-span-2">
                        <label htmlFor="product" className="block text-sm font-medium text-gray-700">สินค้า</label>
                        <select id="product" value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} disabled={!selectedBranchId} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md disabled:bg-gray-100">
                            <option value="">-- เลือกสินค้า --</option>
                            {availableProducts.map(p => <option key={p.productId} value={p.productId} disabled={p.stock === 0}>{p.name} (คงเหลือ: {p.stock})</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">จำนวน</label>
                        <input type="number" id="quantity" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="unitPrice" className="block text-sm font-medium text-gray-700">ราคาขาย (ต่อหน่วย)</label>
                        <input type="number" id="unitPrice" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md" placeholder="0" />
                    </div>
                    <div>
                        <label htmlFor="discount" className="block text-sm font-medium text-gray-700">ส่วนลด (฿)</label>
                        <input type="number" id="discount" value={discount} onChange={(e) => setDiscount(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md" placeholder="0" />
                    </div>
                     <div>
                        <label htmlFor="saleDate" className="block text-sm font-medium text-gray-700">วันที่ขาย</label>
                        <input type="date" id="saleDate" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md" />
                    </div>
                </div>
                {productDetails && <div className="p-4 bg-indigo-50 rounded-lg text-sm grid grid-cols-1 md:grid-cols-3 gap-4">
                    <p><strong>ต้นทุนรวม:</strong> {formatCurrency(productDetails.cost * quantity)}</p>
                    <p><strong>ราคารวม:</strong> <span className={discount > 0 ? 'line-through text-gray-500' : ''}>{formatCurrency(totalAmount)}</span></p>
                    <p><strong>ยอดสุทธิ:</strong> <span className="font-bold text-indigo-600">{formatCurrency(finalAmount)}</span></p>
                </div>}
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <div className="text-right">
                    <button type="submit" disabled={isSubmitting || !selectedProductId} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300">
                        {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการขาย'}
                    </button>
                </div>
            </form>
        </div>
    );
};

const SalesList = ({ sales, loading }) => {
    if (loading) return <div className="text-center p-8"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500 mx-auto"></div><p className="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p></div>;
    if (sales.length === 0) return <div className="text-center bg-white rounded-xl shadow-md p-8"><h3 className="mt-2 text-lg font-medium text-gray-900">ยังไม่มีรายการขาย</h3></div>;
    return (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วันที่</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สินค้า</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">จำนวน</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ส่วนลด</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ยอดขายสุทธิ</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ต้นทุนรวม</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ช่องทาง</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sales.map((sale) => (
                            <tr key={sale.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(sale.date)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sale.product}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sale.quantity}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-500">{formatCurrency(sale.discount || 0)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{formatCurrency(sale.amount)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(sale.cost)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sale.salesChannel}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


// --- Inventory Components ---
const InventoryStats = ({ inventory }) => {
    const stats = useMemo(() => {
        const totalProducts = inventory.length;
        const totalStockValueCost = inventory.reduce((sum, item) => sum + (item.cost * item.stock), 0);
        const totalStockUnits = inventory.reduce((sum, item) => sum + item.stock, 0);
        const lowStockItems = inventory.filter(item => item.stock < 5).length;
        return { totalProducts, totalStockValueCost, totalStockUnits, lowStockItems };
    }, [inventory]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 my-6">
            <StatsCard title="จำนวนสินค้าทั้งหมด" value={stats.totalProducts} icon={<svg className="h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>} />
            <StatsCard title="จำนวนสินค้าในคลัง (ชิ้น)" value={stats.totalStockUnits} icon={<svg className="h-6 w-6 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>} />
            <StatsCard title="มูลค่าสต็อก (ราคาซื้อ)" value={formatCurrency(stats.totalStockValueCost)} icon={<svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>} />
            <StatsCard title="สินค้าใกล้หมด" value={`${stats.lowStockItems} รายการ`} icon={<svg className="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>} />
        </div>
    );
};

const InventoryCSVUploader = ({ db, userId }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [file, setFile] = useState(null);

    const handleFileChange = (e) => {
        setError('');
        setSuccessMessage('');
        if (e.target.files.length) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError('กรุณาเลือกไฟล์ CSV ก่อน');
            return;
        }
        setIsUploading(true);
        setError('');
        setSuccessMessage('');

        const reader = new FileReader();
        reader.onload = async (event) => {
            const csvData = event.target.result;
            const lines = csvData.split('\n').filter(line => line.trim() !== '');
            
            if (lines.length <= 1) {
                setError('ไฟล์ CSV ว่างเปล่าหรือมีแค่หัวข้อ');
                setIsUploading(false);
                return;
            }

            const headers = lines[0].split(',').map(h => h.trim());
            const requiredHeaders = ['date', 'sku', 'barcode', 'brand', 'name', 'stock', 'cost', 'shippingCost'];
            
            const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
            if (missingHeaders.length > 0) {
                 setError(`ไฟล์ CSV ขาดหัวข้อที่จำเป็น: ${missingHeaders.join(', ')}`);
                 setIsUploading(false);
                 return;
            }

            const productsToAdd = [];
            const errors = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                if (values.length !== headers.length) {
                    errors.push(`แถวที่ ${i + 1}: จำนวนคอลัมน์ไม่ตรงกับหัวข้อ`);
                    continue;
                }

                const productData = headers.reduce((obj, header, index) => {
                    obj[header] = values[index];
                    return obj;
                }, {});

                const stock = Number(productData.stock);
                const cost = Number(productData.cost);
                const shippingCost = Number(productData.shippingCost) || 0;

                if (isNaN(stock) || isNaN(cost)) {
                     errors.push(`แถวที่ ${i + 1}: ข้อมูล stock หรือ cost ไม่ใช่ตัวเลข`);
                     continue;
                }
                
                productsToAdd.push({
                    date: productData.date ? new Date(productData.date + 'T00:00:00') : new Date(),
                    sku: productData.sku || '',
                    barcode: productData.barcode || '',
                    brand: productData.brand || '',
                    name: productData.name || `สินค้าแถวที่ ${i+1}`,
                    stock,
                    cost,
                    price: 0, // Price is set per sale, not in inventory
                    shippingCost,
                });
            }

            if (errors.length > 0) {
                setError(`พบข้อผิดพลาดในไฟล์:\n${errors.join('\n')}`);
                setIsUploading(false);
                return;
            }

            if (productsToAdd.length === 0) {
                setError('ไม่พบข้อมูลสินค้าที่ถูกต้องในไฟล์ CSV');
                setIsUploading(false);
                return;
            }

            try {
                const inventoryCollection = collection(db, 'users', userId, 'inventory');
                const batch = writeBatch(db);
                
                productsToAdd.forEach(product => {
                    const docRef = doc(inventoryCollection);
                    batch.set(docRef, product);
                });

                await batch.commit();
                setSuccessMessage(`เพิ่มสินค้าจำนวน ${productsToAdd.length} รายการสำเร็จ!`);
                setFile(null);
                document.getElementById('csv-file-input').value = '';

            } catch (err) {
                console.error("Error batch writing from CSV: ", err);
                setError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
            } finally {
                setIsUploading(false);
            }
        };

        reader.onerror = () => {
             setError('ไม่สามารถอ่านไฟล์ได้');
             setIsUploading(false);
        };

        reader.readAsText(file, 'UTF-8');
    };

    return (
        <div className="bg-gray-50 p-6 rounded-xl shadow-md mb-6 border-t-4 border-indigo-300">
            <h2 className="text-xl font-bold text-gray-800 mb-2">เพิ่มสินค้าจำนวนมาก (Upload CSV)</h2>
            <p className="text-sm text-gray-600 mb-4">
                เตรียมไฟล์ CSV ของคุณโดยมีหัวข้อคอลัมน์ดังนี้: 
                <code className="text-xs bg-gray-200 p-1 rounded">date,sku,barcode,brand,name,stock,cost,shippingCost</code>
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4">
                <input 
                    type="file" 
                    id="csv-file-input"
                    accept=".csv" 
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                <button 
                    onClick={handleUpload} 
                    disabled={isUploading || !file}
                    className="w-full sm:w-auto inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed"
                >
                    {isUploading ? 'กำลังอัปโหลด...' : 'อัปโหลด'}
                </button>
            </div>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            {successMessage && <p className="text-green-600 text-sm mt-2">{successMessage}</p>}
        </div>
    );
};

const AddInventoryForm = ({ db, userId }) => {
    const [name, setName] = useState('');
    const [brand, setBrand] = useState('');
    const [stock, setStock] = useState('');
    const [cost, setCost] = useState('');
    const [shippingCost, setShippingCost] = useState('');
    const [dateAdded, setDateAdded] = useState('');
    const [sku, setSku] = useState('');
    const [barcode, setBarcode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name || !stock || !cost || !userId) {
            setError("กรุณากรอกข้อมูลให้ครบ: ชื่อ, จำนวน, และราคาซื้อ");
            return;
        }
        setIsSubmitting(true);
        setError('');
        try {
            const inventoryCollection = collection(db, 'users', userId, 'inventory');
            const dateToStore = dateAdded ? new Date(dateAdded + 'T00:00:00') : new Date();
            await addDoc(inventoryCollection, {
                name,
                brand,
                stock: Number(stock),
                price: 0, // Price is set per sale
                cost: Number(cost),
                shippingCost: Number(shippingCost) || 0,
                date: dateToStore,
                sku,
                barcode,
            });
            setName('');
            setBrand('');
            setStock('');
            setCost('');
            setShippingCost('');
            setDateAdded('');
            setSku('');
            setBarcode('');
        } catch (err) {
            console.error("Error adding inventory: ", err);
            setError("ไม่สามารถเพิ่มสินค้าได้");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">เพิ่มสินค้าทีละรายการ</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="inv-date" className="block text-sm font-medium text-gray-700">วันที่เพิ่ม</label>
                        <input type="date" id="inv-date" value={dateAdded} onChange={e => setDateAdded(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                    </div>
                    <div>
                        <label htmlFor="inv-sku" className="block text-sm font-medium text-gray-700">SKU</label>
                        <input type="text" id="inv-sku" value={sku} onChange={e => setSku(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="รหัสสินค้า" />
                    </div>
                    <div>
                        <label htmlFor="inv-barcode" className="block text-sm font-medium text-gray-700">Barcode</label>
                        <input type="text" id="inv-barcode" value={barcode} onChange={e => setBarcode(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="รหัสบาร์โค้ด" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="inv-brand" className="block text-sm font-medium text-gray-700">แบรนด์</label>
                        <input type="text" id="inv-brand" value={brand} onChange={e => setBrand(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="เช่น No-Brand" />
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="inv-name" className="block text-sm font-medium text-gray-700">ชื่อสินค้า</label>
                        <input type="text" id="inv-name" value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="เช่น เสื้อยืดลายแมว" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label htmlFor="inv-stock" className="block text-sm font-medium text-gray-700">จำนวน</label>
                        <input type="number" id="inv-stock" value={stock} onChange={e => setStock(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="100" />
                    </div>
                    <div>
                        <label htmlFor="inv-cost" className="block text-sm font-medium text-gray-700">ราคาซื้อ (ต่อหน่วย)</label>
                        <input type="number" id="inv-cost" value={cost} onChange={e => setCost(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="150" />
                    </div>
                     <div>
                        <label htmlFor="inv-shipping" className="block text-sm font-medium text-gray-700">ค่าขนส่ง (รวม)</label>
                        <input type="number" id="inv-shipping" value={shippingCost} onChange={e => setShippingCost(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="500" />
                    </div>
                </div>
                 <div className="text-right">
                    <button type="submit" disabled={isSubmitting} className="w-full md:w-auto inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300">
                        {isSubmitting ? 'กำลังเพิ่ม...' : 'เพิ่มสินค้า'}
                    </button>
                </div>
            </form>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
    );
};

const InventoryList = ({ inventory, db, userId, loading, onEdit }) => {
    const handleDelete = async (id) => {
        if (!userId) return;
        try {
            await deleteDoc(doc(db, 'users', userId, 'inventory', id));
        } catch (error) {
            console.error("Error deleting inventory item: ", error);
        }
    };
    if (loading) return <div className="text-center p-8"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500 mx-auto"></div><p className="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p></div>;
    if (inventory.length === 0) return <div className="text-center bg-white rounded-xl shadow-md p-8"><h3 className="mt-2 text-lg font-medium text-gray-900">ยังไม่มีสินค้าในสต็อก</h3></div>;
    return (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วันที่เพิ่ม</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Barcode</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">แบรนด์</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ชื่อสินค้า</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">คงเหลือ</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ราคาซื้อ</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ค่าขนส่ง</th>
                            <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {inventory.map((item) => {
                            const stockClass = item.stock < 5 ? 'bg-red-100 text-red-800' : item.stock < 10 ? 'bg-yellow-100 text-yellow-800' : '';
                            return (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(item.date)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.sku || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.barcode || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.brand || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${stockClass}`}>
                                            {item.stock}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(item.cost)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(item.shippingCost || 0)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                        <button onClick={() => onEdit(item)} className="text-indigo-600 hover:text-indigo-900">แก้ไข</button>
                                        <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900">ลบ</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const EditInventoryModal = ({ item, db, userId, onClose }) => {
    const [name, setName] = useState(item.name);
    const [brand, setBrand] = useState(item.brand || '');
    const [stock, setStock] = useState(item.stock);
    const [cost, setCost] = useState(item.cost);
    const [shippingCost, setShippingCost] = useState(item.shippingCost || '');
    const [date, setDate] = useState(item.date ? new Date(item.date.toDate()).toISOString().split('T')[0] : '');
    const [sku, setSku] = useState(item.sku || '');
    const [barcode, setBarcode] = useState(item.barcode || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const itemRef = doc(db, 'users', userId, 'inventory', item.id);
        try {
            await updateDoc(itemRef, {
                name,
                brand,
                stock: Number(stock),
                cost: Number(cost),
                shippingCost: Number(shippingCost) || 0,
                date: new Date(date + 'T00:00:00'),
                sku,
                barcode,
            });
            onClose();
        } catch (error) {
            console.error("Error updating inventory: ", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-auto">
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <h3 className="text-lg font-medium text-gray-900">แก้ไข: {item.name}</h3>
                        <div className="mt-4 space-y-4">
                            <div>
                                <label htmlFor="edit-date" className="block text-sm font-medium text-gray-700">วันที่เพิ่ม</label>
                                <input type="date" id="edit-date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                            </div>
                             <div>
                                <label htmlFor="edit-sku" className="block text-sm font-medium text-gray-700">SKU</label>
                                <input type="text" id="edit-sku" value={sku} onChange={e => setSku(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                            </div>
                            <div>
                                <label htmlFor="edit-barcode" className="block text-sm font-medium text-gray-700">Barcode</label>
                                <input type="text" id="edit-barcode" value={barcode} onChange={e => setBarcode(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                            </div>
                            <div>
                                <label htmlFor="edit-brand" className="block text-sm font-medium text-gray-700">แบรนด์</label>
                                <input type="text" id="edit-brand" value={brand} onChange={e => setBrand(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                            </div>
                            <div>
                                <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700">ชื่อสินค้า</label>
                                <input type="text" id="edit-name" value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                            </div>
                            <div>
                                <label htmlFor="edit-stock" className="block text-sm font-medium text-gray-700">จำนวนคงเหลือ</label>
                                <input type="number" id="edit-stock" value={stock} onChange={e => setStock(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                            </div>
                             <div>
                                <label htmlFor="edit-cost" className="block text-sm font-medium text-gray-700">ราคาซื้อ (ต่อหน่วย)</label>
                                <input type="number" id="edit-cost" value={cost} onChange={e => setCost(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                            </div>
                            <div>
                                <label htmlFor="edit-shipping" className="block text-sm font-medium text-gray-700">ค่าขนส่ง (รวม)</label>
                                <input type="number" id="edit-shipping" value={shippingCost} onChange={e => setShippingCost(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 px-6 py-3 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="py-2 px-4 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 border border-gray-300">ยกเลิก</button>
                        <button type="submit" disabled={isSubmitting} className="py-2 px-4 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300">บันทึก</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Branch View Components ---
const BranchView = ({ db, userId, inventory, branches, branchInventory, sales }) => {
    const [selectedBranchId, setSelectedBranchId] = useState('');
    const [newBranchName, setNewBranchName] = useState('');
    const [isAddingBranch, setIsAddingBranch] = useState(false);
    const [distributeProductId, setDistributeProductId] = useState('');
    const [distributeQuantity, setDistributeQuantity] = useState(1);
    const [isDistributing, setIsDistributing] = useState(false);

    const handleAddBranch = async (e) => {
        e.preventDefault();
        if (!newBranchName) return;
        setIsAddingBranch(true);
        const branchesCollection = collection(db, 'users', userId, 'branches');
        await addDoc(branchesCollection, { name: newBranchName });
        setNewBranchName('');
        setIsAddingBranch(false);
    };

    const handleDistributeStock = async (e) => {
        e.preventDefault();
        if (!distributeProductId || !distributeQuantity || !selectedBranchId) return;
        setIsDistributing(true);

        const branchInventoryCollection = collection(db, 'users', userId, 'branchInventory');
        
        const q = query(branchInventoryCollection, where("branchId", "==", selectedBranchId), where("productId", "==", distributeProductId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            await addDoc(branchInventoryCollection, {
                branchId: selectedBranchId,
                productId: distributeProductId,
                stock: Number(distributeQuantity)
            });
        } else {
            const docToUpdate = querySnapshot.docs[0];
            const newStock = docToUpdate.data().stock + Number(distributeQuantity);
            await updateDoc(doc(db, 'users', userId, 'branchInventory', docToUpdate.id), {
                stock: newStock
            });
        }
        
        setDistributeProductId('');
        setDistributeQuantity(1);
        setIsDistributing(false);
    };

    const currentBranchInventory = useMemo(() => {
        if (!selectedBranchId) return [];
        return branchInventory
            .filter(item => item.branchId === selectedBranchId)
            .map(item => {
                const masterProduct = inventory.find(p => p.id === item.productId);
                return { ...masterProduct, ...item };
            });
    }, [selectedBranchId, branchInventory, inventory]);
    
    const currentBranchSales = useMemo(() => {
        if (!selectedBranchId) return [];
        return sales.filter(sale => sale.branchId === selectedBranchId);
    }, [selectedBranchId, sales]);

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white p-6 rounded-xl shadow-md">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">เพิ่มสาขา / Vending Machine</h3>
                    <form onSubmit={handleAddBranch} className="flex items-center gap-2">
                        <input 
                            type="text" 
                            value={newBranchName} 
                            onChange={(e) => setNewBranchName(e.target.value)} 
                            placeholder="เช่น สาขาสยาม, ตู้ MBK ชั้น 4" 
                            className="flex-grow block w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                        <button type="submit" disabled={isAddingBranch || !newBranchName} className="py-2 px-4 border border-transparent rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300">
                            {isAddingBranch ? '...' : 'เพิ่ม'}
                        </button>
                    </form>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md">
                     <h3 className="text-lg font-bold text-gray-800 mb-4">เลือกสาขาเพื่อดูข้อมูล</h3>
                     <select value={selectedBranchId} onChange={(e) => setSelectedBranchId(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-md">
                        <option value="">-- กรุณาเลือกสาขา --</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                     </select>
                </div>
            </div>

            {selectedBranchId && (
                <div className="space-y-8">
                    <div className="bg-white p-6 rounded-xl shadow-md">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">กระจายสินค้าเข้าสาขา: {branches.find(b => b.id === selectedBranchId)?.name}</h3>
                        <form onSubmit={handleDistributeStock} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                             <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">เลือกสินค้าจากคลังกลาง</label>
                                <select value={distributeProductId} onChange={e => setDistributeProductId(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">
                                    <option value="">-- เลือกสินค้า --</option>
                                    {inventory.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">จำนวนที่เพิ่ม</label>
                                <input type="number" min="1" value={distributeQuantity} onChange={e => setDistributeQuantity(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                            </div>
                            <div className="md:col-span-3 text-right">
                                <button type="submit" disabled={isDistributing || !distributeProductId} className="py-2 px-4 border border-transparent rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300">
                                    {isDistributing ? '...' : 'เพิ่มสต็อกสาขา'}
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div>
                             <h3 className="text-xl font-bold text-gray-800 mb-4">สต็อกสินค้าในสาขา</h3>
                             <InventoryList inventory={currentBranchInventory} loading={false} onEdit={() => {}} db={db} userId={userId} />
                        </div>
                         <div>
                             <h3 className="text-xl font-bold text-gray-800 mb-4">ประวัติการขายในสาขา</h3>
                             <SalesList sales={currentBranchSales} loading={false} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


// --- Main App Component ---
export default function App() {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [sales, setSales] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [branches, setBranches] = useState([]);
    const [branchInventory, setBranchInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [yearFilter, setYearFilter] = useState('all');
    const [monthFilter, setMonthFilter] = useState('all');
    const [currentView, setCurrentView] = useState('sales'); // 'sales' or 'inventory' or 'branch'
    const [editingItem, setEditingItem] = useState(null); // For inventory edit modal

    // Initialize Firebase
    useEffect(() => {
        try {
            if (Object.keys(firebaseConfig).length === 0) { console.error("Firebase config is not available."); return; }
            const app = initializeApp(firebaseConfig);
            setDb(getFirestore(app));
            setAuth(getAuth(app));
        } catch (e) { console.error("Error initializing Firebase:", e); }
    }, []);

    // Handle Authentication
    useEffect(() => {
        if (!auth) return;
        const authUser = async () => {
            try {
                 await signInAnonymously(auth);
            } catch (error) {
               console.error("Authentication failed:", error);
            }
        };
        const unsubscribe = onAuthStateChanged(auth, user => {
            setUserId(user ? user.uid : null);
            setIsAuthReady(true);
        });
        authUser();
        return () => unsubscribe();
    }, [auth]);

    // Fetch Data (Sales & Inventory)
    useEffect(() => {
        if (!db || !userId || !isAuthReady) {
            if (isAuthReady && !userId) setLoading(false);
            return;
        }
        setLoading(true);
        
        const salesQuery = query(collection(db, 'users', userId, 'sales'));
        const inventoryQuery = query(collection(db, 'users',userId, 'inventory'));
        const branchesQuery = query(collection(db, 'users', userId, 'branches'));
        const branchInventoryQuery = query(collection(db, 'users', userId, 'branchInventory'));

        const unsubSales = onSnapshot(salesQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), date: doc.data().date?.toDate() })).sort((a, b) => b.date - a.date);
            setSales(data);
            setLoading(false);
        }, (error) => { console.error("Error fetching sales:", error); setLoading(false); });

        const unsubInventory = onSnapshot(inventoryQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), date: doc.data().date?.toDate() })).sort((a,b) => b.date - a.date);
            setInventory(data);
        }, (error) => console.error("Error fetching inventory:", error));
        
        const unsubBranches = onSnapshot(branchesQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setBranches(data);
        }, (error) => console.error("Error fetching branches:", error));

        const unsubBranchInventory = onSnapshot(branchInventoryQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setBranchInventory(data);
        }, (error) => console.error("Error fetching branch inventory:", error));

        return () => {
            unsubSales();
            unsubInventory();
            unsubBranches();
            unsubBranchInventory();
        };
    }, [db, userId, isAuthReady]);

    const filteredSales = useMemo(() => {
        if (yearFilter === 'all') {
            return sales;
        }

        const year = parseInt(yearFilter, 10);
        let salesToFilter = sales.filter(sale => sale.date && sale.date.getFullYear() === year);

        if (monthFilter !== 'all') {
            const month = parseInt(monthFilter, 10);
            salesToFilter = salesToFilter.filter(sale => sale.date && sale.date.getMonth() === month);
        }
        
        return salesToFilter;
    }, [sales, yearFilter, monthFilter]);

    return (
        <div className="bg-gray-100 min-h-screen font-sans">
            <Header />
            <main className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {!isAuthReady ? (
                    <div className="text-center p-8"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500 mx-auto"></div><p className="mt-4 text-gray-600">กำลังยืนยันตัวตน...</p></div>
                ) : (
                    <>
                        <ViewSwitcher currentView={currentView} setCurrentView={setCurrentView} />
                        <div className="bg-white rounded-b-xl rounded-r-xl shadow-md p-6">
                            {currentView === 'sales' && (
                                <>
                                    <FilterControls 
                                        yearFilter={yearFilter} 
                                        setYearFilter={setYearFilter} 
                                        monthFilter={monthFilter} 
                                        setMonthFilter={setMonthFilter} 
                                    />
                                    <SalesStats sales={filteredSales} />
                                    <AddSaleForm db={db} userId={userId} inventory={inventory} branches={branches} branchInventory={branchInventory} />
                                    <SalesList sales={sales} loading={loading} />
                                </>
                            )}
                            {currentView === 'inventory' && (
                                <>
                                    <InventoryStats inventory={inventory} />
                                    <InventoryCSVUploader db={db} userId={userId} />
                                    <AddInventoryForm db={db} userId={userId} />
                                    <InventoryList inventory={inventory} db={db} userId={userId} loading={loading} onEdit={setEditingItem} />
                                </>
                            )}
                            {currentView === 'branch' && (
                                <BranchView 
                                    db={db}
                                    userId={userId}
                                    inventory={inventory}
                                    branches={branches}
                                    branchInventory={branchInventory}
                                    sales={sales}
                                />
                            )}
                        </div>
                    </>
                )}
            </main>
            {editingItem && (
                <EditInventoryModal item={editingItem} db={db} userId={userId} onClose={() => setEditingItem(null)} />
            )}
        </div>
    );
}
