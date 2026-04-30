import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const AuditLogView = ({ user, onBack }) => {
    const [logs, setLogs] = useState([]);
    const [totalLogs, setTotalLogs] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [filters, setFilters] = useState({
        actor_id: '',
        action: '',
        entity_type: '',
        entity_id: '',
        start_date: '',
        end_date: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchAuditLogs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                limit,
                page: currentPage,
                ...filters
            }).toString();
            const response = await api.get(`analytics/audit-logs?${params}`);
            setLogs(response.data.data);
            setTotalLogs(response.data.total);
        } catch (err) {
            console.error("Failed to fetch audit logs:", err);
            setError("Gagal memuat log audit. Pastikan Anda memiliki izin.");
        } finally {
            setLoading(false);
        }
    }, [limit, currentPage, filters]);

    useEffect(() => {
        fetchAuditLogs();
    }, [fetchAuditLogs]);

    const exportToCSV = () => {
        if (logs.length === 0) return alert("Tidak ada data untuk diekspor");
        
        try {
            const headers = ["ID", "Waktu", "Aktor", "Role", "Aksi", "Entitas", "ID Entitas", "Detail"];
            const csvRows = [headers.map(h => `"${h}"`).join(",")];

            logs.forEach(log => {
                const row = [
                    log.id,
                    new Date(log.created_at).toLocaleString(),
                    log.actor_name,
                    log.actor_role,
                    log.action,
                    log.entity_type,
                    log.entity_id,
                    log.payload ? JSON.stringify(log.payload).replace(/"/g, '""') : "-"
                ];
                csvRows.push(row.map(v => `"${v}"`).join(","));
            });

            const csvString = csvRows.join("\n");
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `audit_logs_${new Date().getTime()}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            alert("Gagal mengekspor CSV");
        }
    };

    const exportToPDF = () => {
        if (logs.length === 0) return alert("Tidak ada data untuk diekspor");
        
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Laporan Audit Log - Pusdatin NU Peduli", 14, 15);
        doc.setFontSize(10);
        doc.text(`Dicetak pada: ${new Date().toLocaleString()}`, 14, 22);

        const tableRows = logs.map(log => [
            log.id,
            new Date(log.created_at).toLocaleString('id-ID'),
            `${log.actor_name} (${log.actor_role})`,
            log.action,
            log.entity_type,
            log.entity_id
        ]);

        autoTable(doc, { head: [["ID", "Waktu", "Aktor", "Aksi", "Entitas", "ID"]], body: tableRows, startY: 30, theme: 'grid', headStyles: { fillColor: [0, 100, 50] } });
        doc.save(`audit_logs_${new Date().getTime()}.pdf`);
    };

    const handleFilterChange = (e) => {
        setFilters({
            ...filters,
            [e.target.name]: e.target.value
        });
        setCurrentPage(1); // Reset to first page on filter change
    };

    const handleClearFilters = () => {
        setFilters({
            actor_id: '',
            action: '',
            entity_type: '',
            entity_id: '',
            start_date: '',
            end_date: ''
        });
        setCurrentPage(1);
    };

    const totalPages = Math.ceil(totalLogs / limit);

    return (
        <div className="p-4 md:p-8 bg-[#f8fafc] h-full overflow-y-auto font-sans">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b-2 border-green-50 pb-6 gap-4">
                <div>
                    <button onClick={onBack} className="text-nu-green font-black text-xs uppercase tracking-widest flex items-center gap-2 mb-2">
                        <i className="fas fa-arrow-left"></i> Kembali
                    </button>
                    <h2 className="text-2xl md:text-3xl font-black text-[#006432] uppercase italic tracking-tighter leading-none">Audit Log System</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">Aktivitas Pengguna & Sistem</p>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <button onClick={exportToCSV} className="bg-slate-800 text-white px-6 py-3 rounded-2xl font-black uppercase text-[9px] shadow-lg flex items-center gap-2">
                        <i className="fas fa-file-csv"></i> CSV
                    </button>
                    <button onClick={exportToPDF} className="bg-red-700 text-white px-6 py-3 rounded-2xl font-black uppercase text-[9px] shadow-lg flex items-center gap-2">
                        <i className="fas fa-file-pdf"></i> PDF
                    </button>
                    <button 
                        onClick={fetchAuditLogs}
                        className="bg-[#006432] text-white px-6 py-3 rounded-2xl font-black uppercase text-[9px] shadow-xl hover:bg-green-800 transition-all flex items-center justify-center gap-3"
                    >
                        <i className="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>

            {/* Filter Section */}
            <div className="bg-white p-6 rounded-[35px] shadow-lg border border-slate-100 mb-8">
                <h3 className="text-sm font-black text-slate-800 uppercase mb-4">Filter Logs</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input type="text" name="actor_id" placeholder="Actor ID" value={filters.actor_id} onChange={handleFilterChange} className="p-3 border rounded-xl text-xs" />
                    <input type="text" name="action" placeholder="Action (e.g., DELETE_BUILDING)" value={filters.action} onChange={handleFilterChange} className="p-3 border rounded-xl text-xs" />
                    <input type="text" name="entity_type" placeholder="Entity Type (e.g., buildings)" value={filters.entity_type} onChange={handleFilterChange} className="p-3 border rounded-xl text-xs" />
                    <input type="text" name="entity_id" placeholder="Entity ID" value={filters.entity_id} onChange={handleFilterChange} className="p-3 border rounded-xl text-xs" />
                    <input type="date" name="start_date" placeholder="Start Date" value={filters.start_date} onChange={handleFilterChange} className="p-3 border rounded-xl text-xs" />
                    <input type="date" name="end_date" placeholder="End Date" value={filters.end_date} onChange={handleFilterChange} className="p-3 border rounded-xl text-xs" />
                </div>
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={handleClearFilters} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold">Clear Filters</button>
                    <button onClick={fetchAuditLogs} className="bg-[#006432] text-white px-4 py-2 rounded-xl text-xs font-bold">Apply Filters</button>
                </div>
            </div>

            {loading && <div className="text-center py-10 text-slate-500">Loading audit logs...</div>}
            {error && <div className="text-center py-10 text-red-600">{error}</div>}

            {!loading && !error && (
                <>
                    <div className="bg-white p-6 rounded-[35px] shadow-lg border border-slate-100 overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actor</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payload</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {logs.map((log) => (
                                    <tr key={log.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.id}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(log.created_at).toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.actor_name} ({log.actor_role})</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.action}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.entity_type}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.entity_id}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {log.payload ? JSON.stringify(log.payload).substring(0, 50) + '...' : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex justify-between items-center mt-4">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-gray-700">
                            Page {currentPage} of {totalPages} ({totalLogs} entries)
                        </span>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default AuditLogView;