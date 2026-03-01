/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { RefreshCw, Moon, Sun, Calendar, Settings, X, Loader2, Database, Edit, Trash2, Plus, Save, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

interface DailyData {
  date: string;
  begin_civil_twilight: string;
  sunrise: string;
  sun_transit: string;
  sunset: string;
  end_civil_twilight: string;
  day_length: string;
  visible_light_length: string;
  moonrise: string;
  moonset: string;
  moon_illumination: string;
  moon_phase: string;
  next_moon_phase: string;
}

type ColumnKey = keyof Omit<DailyData, 'date'>;

const COLUMN_CONFIG: { key: ColumnKey; label: string; className?: string }[] = [
  { key: 'begin_civil_twilight', label: 'INICIO DEL CREPÚSCULO CIVIL', className: 'text-orange-600' },
  { key: 'sunrise', label: 'AMANECER', className: 'text-orange-600' },
  { key: 'sun_transit', label: 'MEDIODÍA SOLAR', className: 'text-orange-600' },
  { key: 'sunset', label: 'ATARDECER', className: 'text-orange-600' },
  { key: 'end_civil_twilight', label: 'FINAL DEL CREPÚSCULO CIVIL', className: 'text-orange-600' },
  { key: 'day_length', label: 'DURACIÓN DEL DÍA', className: 'font-bold text-slate-700' },
  { key: 'visible_light_length', label: 'DURACIÓN DE LA LUZ VISIBLE', className: 'font-bold text-slate-700' },
  { key: 'moonrise', label: 'SALIDA DE LA LUNA', className: 'text-indigo-600' },
  { key: 'moonset', label: 'PUESTA DE LA LUNA', className: 'text-indigo-600' },
  { key: 'moon_illumination', label: 'ILUMINACIÓN DE LA LUNA', className: 'text-indigo-600' },
  { key: 'moon_phase', label: 'FASE LUNAR ACTUAL', className: 'text-indigo-600' },
  { key: 'next_moon_phase', label: 'PRÓXIMA FASE PRINCIPAL', className: 'text-slate-400' },
];

const PHASE_MAP: Record<string, string> = {
  "New Moon": "Luna nueva",
  "First Quarter": "Cuarto creciente",
  "Full Moon": "Luna llena",
  "Last Quarter": "Cuarto menguante",
  "Waxing Crescent": "Luna creciente",
  "Waxing Gibbous": "Gibosa creciente",
  "Waning Gibbous": "Gibosa menguante",
  "Waning Crescent": "Luna menguante"
};

export default function App() {
  const [data, setData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(false);
  const [scrapingStatus, setScrapingStatus] = useState<{ count: number; total: number } | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(2026);
  const startYear = 1700;
  const endYear = 2100;
  const years = Array.from({length: endYear - startYear + 1}, (_, i) => startYear + i);

  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
    begin_civil_twilight: true,
    sunrise: true,
    sun_transit: true,
    sunset: true,
    end_civil_twilight: true,
    day_length: true,
    visible_light_length: true,
    moonrise: true,
    moonset: true,
    moon_illumination: true,
    moon_phase: true,
    next_moon_phase: true,
  });
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  
  // Admin Mode State
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DailyData | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const translatePhaseName = (phase: string) => {
    return PHASE_MAP[phase] || phase;
  };

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/data?month=${selectedMonth}&year=${selectedYear}`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.warn("Received non-JSON response from API");
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const checkStatus = async () => {
    try {
      const res = await fetch(`/api/status?year=${selectedYear}`);
      if (!res.ok) return;
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) return;
      
      const json = await res.json();
      setScrapingStatus(json);
    } catch (err) {
      console.error(err);
    }
  };

  const startScraping = async () => {
    setIsStarting(true);
    console.log(`[Frontend] Iniciando solicitud de scraping para el año: ${selectedYear}`);
    try {
      const res = await fetch('/api/scrape', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: selectedYear })
      });
      
      console.log(`[Frontend] Respuesta recibida. Status: ${res.status} ${res.statusText}`);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("[Frontend] Error del servidor (cuerpo):", errorText);
        
        // Try to parse JSON error if possible
        let errorMessage = errorText;
        try {
            const jsonError = JSON.parse(errorText);
            if (jsonError.error) errorMessage = jsonError.error;
        } catch (e) {
            // Not JSON, use raw text (likely HTML if 404/500 from Vite)
            if (errorMessage.startsWith('<!doctype')) {
                errorMessage = "El servidor devolvió HTML en lugar de JSON. Posible error de ruta (404) o servidor no listo.";
            }
        }

        alert(`Error al iniciar (${res.status}): ${errorMessage}`);
        return;
      }

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
          const text = await res.text();
          console.error("[Frontend] Respuesta no es JSON:", text.substring(0, 100));
          alert("Error: El servidor no devolvió JSON. Revisa la consola.");
          return;
      }

      const data = await res.json();
      console.log("[Frontend] Datos recibidos:", data);

      // Trigger an immediate status check
      await checkStatus();
      
    } catch (err) {
      console.error("[Frontend] Error de red o ejecución:", err);
      alert(`Error de conexión: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsStarting(false);
    }
  };

  // CRUD Operations
  const handleSaveRecord = async (record: DailyData) => {
    try {
      const isNew = !data.find(d => d.date === record.date);
      const url = isNew ? '/api/records' : `/api/records/${record.date}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });

      if (!res.ok) throw new Error("Failed to save record");
      
      setIsEditModalOpen(false);
      fetchData(true);
      alert("Registro guardado correctamente");
    } catch (error) {
      alert("Error al guardar: " + error);
    }
  };

  const handleDeleteRecord = async (date: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este registro?")) return;
    try {
      const res = await fetch(`/api/records/${date}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to delete record");
      fetchData(true);
    } catch (error) {
      alert("Error al eliminar: " + error);
    }
  };

  const openEditModal = (record?: DailyData) => {
    if (record) {
      setEditingRecord(record);
    } else {
      // New record template
      const monthStr = String(selectedMonth).padStart(2, '0');
      setEditingRecord({
        date: `${selectedYear}-${monthStr}-01`,
        begin_civil_twilight: '', sunrise: '', sun_transit: '', sunset: '', end_civil_twilight: '',
        day_length: '', visible_light_length: '', moonrise: '', moonset: '',
        moon_illumination: '0%', moon_phase: 'New Moon', next_moon_phase: ''
      });
    }
    setIsEditModalOpen(true);
  };

  useEffect(() => {
    fetchData();
    checkStatus();
  }, [selectedMonth, selectedYear]);

  // Poll status periodically
  useEffect(() => {
    const interval = setInterval(checkStatus, 2000); // Check every 2 seconds
    return () => clearInterval(interval);
  }, [selectedYear]);

  // Auto-refresh data when scraping progress updates
  useEffect(() => {
    if (scrapingStatus?.count) {
        fetchData(true); // Silent refresh
    }
  }, [scrapingStatus?.count]);

  const isScrapingComplete = scrapingStatus && scrapingStatus.count >= scrapingStatus.total;

  const getMoonIcon = (phase: string) => {
    const p = phase.toLowerCase();
    if (p.includes('new')) return '🌑';
    if (p.includes('waxing') && p.includes('crescent')) return '🌒';
    if (p.includes('first quarter')) return '🌓';
    if (p.includes('waxing') && p.includes('gibbous')) return '🌔';
    if (p.includes('full')) return '🌕';
    if (p.includes('waning') && p.includes('gibbous')) return '🌖';
    if (p.includes('last quarter')) return '🌗';
    if (p.includes('waning') && p.includes('crescent')) return '🌘';
    return '🌑';
  };

  const translateNextPhase = (text: string) => {
    if (!text) return '';
    
    // Regex to match "Phase on Day Month Year"
    // Example: "Full Moon on 3 March 2026"
    const regex = /^(.*?) on (\d+) ([a-zA-Z]+) (\d+)$/;
    const match = text.match(regex);

    if (!match) return text;

    const [_, phase, day, month, year] = match;

    const monthMap: Record<string, string> = {
      "January": "enero", "February": "febrero", "March": "marzo", "April": "abril",
      "May": "mayo", "June": "junio", "July": "julio", "August": "agosto",
      "September": "septiembre", "October": "octubre", "November": "noviembre", "December": "diciembre"
    };

    const translatedPhase = PHASE_MAP[phase] || phase;
    const translatedMonth = monthMap[month] || month;

    return `${translatedPhase} el ${day} de ${translatedMonth} de ${year}`;
  };

  const handleDeleteMonth = async () => {
    try {
      const res = await fetch(`/api/records/month/${selectedYear}/${selectedMonth}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to delete month data");
      
      // Clear data immediately for better UX
      setData([]);
      
      // Then refresh from server to be sure
      fetchData(true);
      checkStatus();
      alert(`Datos del mes ${months[selectedMonth - 1]} ${selectedYear} eliminados correctamente.`);
    } catch (error) {
      alert("Error al eliminar: " + error);
    }
  };

  const handleDeleteYear = async () => {
    try {
      const res = await fetch(`/api/records/year/${selectedYear}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to delete year data");
      
      // Clear data immediately if viewing the deleted year
      setData([]);
      
      fetchData(true);
      checkStatus();
      alert(`Datos del año ${selectedYear} eliminados correctamente.`);
    } catch (error) {
      alert("Error al eliminar: " + error);
    }
  };

  const handleDeleteAll = async () => {
    try {
      const res = await fetch(`/api/records/all`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to delete all data");
      
      setData([]);
      
      fetchData(true);
      checkStatus();
      alert("Base de datos vaciada correctamente.");
    } catch (error) {
      alert("Error al eliminar: " + error);
    }
  };

  const prepareDataForExport = (dataToExport: DailyData[]) => {
    return dataToExport.map(row => {
      const newRow: any = { ...row };
      // Translate fields
      newRow.next_moon_phase = translateNextPhase(row.next_moon_phase);
      newRow.moon_phase = translatePhaseName(row.moon_phase);
      
      // Rename keys for better headers
      const exportRow: any = {};
      COLUMN_CONFIG.forEach(col => {
        exportRow[col.label] = newRow[col.key];
      });
      
      // Extract day from date (YYYY-MM-DD)
      const day = parseInt(row.date.split('-')[2]);
      
      // Add day at the beginning
      return { "Día": day, ...exportRow };
    });
  };

  const handleExportMonth = () => {
    if (data.length === 0) {
      alert("No hay datos para exportar en este mes.");
      return;
    }
    const exportData = prepareDataForExport(data);
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, months[selectedMonth - 1]);
    XLSX.writeFile(wb, `Datos_Solares_${selectedYear}_${months[selectedMonth - 1]}.xlsx`);
  };

  const handleExportYear = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/data?year=${selectedYear}`);
      if (!res.ok) throw new Error("Failed to fetch year data");
      const yearData: DailyData[] = await res.json();

      if (yearData.length === 0) {
        alert(`No hay datos disponibles para el año ${selectedYear}.`);
        return;
      }

      const wb = XLSX.utils.book_new();
      
      // Group by month
      months.forEach((monthName, index) => {
        const monthNum = index + 1;
        const monthData = yearData.filter(d => {
            const date = new Date(d.date);
            // Fix timezone issue by using UTC components or string parsing
            const parts = d.date.split('-');
            return parseInt(parts[1]) === monthNum;
        });

        if (monthData.length > 0) {
          const exportData = prepareDataForExport(monthData);
          const ws = XLSX.utils.json_to_sheet(exportData);
          XLSX.utils.book_append_sheet(wb, ws, monthName);
        }
      });

      if (wb.SheetNames.length === 0) {
        alert("No se encontraron datos para exportar.");
        return;
      }

      XLSX.writeFile(wb, `Datos_Solares_${selectedYear}_Completo.xlsx`);
    } catch (error) {
      console.error("Export error:", error);
      alert("Error al exportar el año: " + error);
    } finally {
      setLoading(false);
    }
  };

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Datos Solares y Lunares {selectedYear}</h1>
            <p className="text-slate-500 mt-1">Reconquista, Santa Fe, Argentina</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button
                onClick={() => setIsAdminMode(!isAdminMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    isAdminMode ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
                <Database className="w-4 h-4" />
                {isAdminMode ? 'Salir de Admin' : 'Administrar BD'}
            </button>

            {!isScrapingComplete && (
              <div className="flex items-center gap-3 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg border border-blue-100">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">
                  Recopilando datos: {scrapingStatus?.count || 0} / {scrapingStatus?.total || 365}
                </span>
              </div>
            )}
            
            {(!scrapingStatus || scrapingStatus.count < scrapingStatus.total) && (
               <button 
                 onClick={startScraping}
                 disabled={isStarting}
                 className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"
               >
                 {isStarting && <Loader2 className="w-4 h-4 animate-spin" />}
                 {isStarting ? 'Iniciando...' : `Iniciar Recopilación ${selectedYear}`}
               </button>
            )}
          </div>
        </header>

        {/* Controls */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <Calendar className="w-5 h-5 text-slate-400" />
            
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-700">Año:</span>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-700">Mes:</span>
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {months.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdminMode && (
                <div className="flex items-center gap-2 mr-4 border-r border-slate-200 pr-4">
                    <button
                        onClick={handleDeleteMonth}
                        className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-lg font-medium transition-colors text-xs"
                        title={`Eliminar datos de ${months[selectedMonth - 1]} ${selectedYear}`}
                    >
                        <Trash2 className="w-3 h-3" />
                        Borrar Mes
                    </button>
                    <button
                        onClick={handleDeleteYear}
                        className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-lg font-medium transition-colors text-xs"
                        title={`Eliminar todos los datos de ${selectedYear}`}
                    >
                        <Trash2 className="w-3 h-3" />
                        Borrar Año {selectedYear}
                    </button>
                    <button
                        onClick={handleDeleteAll}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg font-medium transition-colors text-xs"
                        title="Eliminar TODA la base de datos"
                    >
                        <Trash2 className="w-3 h-3" />
                        Borrar TODO
                    </button>
                </div>
            )}

            {isAdminMode && (
                <button
                    onClick={() => openEditModal()}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg font-medium transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Registro
                </button>
            )}

            <div className="flex items-center gap-2 mr-2">
                <button
                    onClick={handleExportMonth}
                    className="flex items-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-2 rounded-lg font-medium transition-colors"
                    title="Exportar mes actual a Excel"
                >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span className="hidden sm:inline">Exportar Mes</span>
                </button>
                <button
                    onClick={handleExportYear}
                    className="flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-2 rounded-lg font-medium transition-colors shadow-sm"
                    title={`Exportar todo el año ${selectedYear} a Excel`}
                >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Exportar Año</span>
                </button>
            </div>

            <div className="relative">
                <button
                onClick={() => setIsCustomizeModalOpen(!isCustomizeModalOpen)}
                className={`flex items-center gap-2 font-medium transition-colors px-3 py-2 rounded-lg ${
                    isCustomizeModalOpen 
                    ? 'bg-indigo-50 text-indigo-600' 
                    : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
                }`}
                >
                <Settings className="w-4 h-4" />
                Personalizar tabla
                </button>

                {isCustomizeModalOpen && (
                <>
                    <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsCustomizeModalOpen(false)} 
                    />
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-20 overflow-hidden ring-1 ring-black/5">
                    <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                        <h3 className="font-semibold text-slate-900 text-sm">Mostrar Columnas</h3>
                        <button onClick={() => setIsCustomizeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                        </button>
                    </div>
                    
                    <div className="p-2 max-h-[60vh] overflow-y-auto space-y-1">
                        {COLUMN_CONFIG.map(col => (
                        <label key={col.key} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors select-none">
                            <div className="pt-0.5">
                            <input 
                                type="checkbox"
                                checked={visibleColumns[col.key]}
                                onChange={() => toggleColumn(col.key)}
                                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                            />
                            </div>
                            <span className="text-xs font-medium text-slate-700 leading-tight">{col.label}</span>
                        </label>
                        ))}
                    </div>
                    </div>
                </>
                )}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium uppercase tracking-wider text-xs border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Día</th>
                  {COLUMN_CONFIG.map(col => visibleColumns[col.key] && (
                    <th key={col.key} className={`px-6 py-4 ${col.className || ''}`}>
                      {col.label}
                    </th>
                  ))}
                  {isAdminMode && <th className="px-6 py-4 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={14} className="px-6 py-12 text-center text-slate-400">
                      Cargando datos...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-6 py-12 text-center text-slate-400">
                      No hay datos disponibles para este mes.
                      {(!scrapingStatus || scrapingStatus.count < scrapingStatus.total) && " Inicia la recopilación arriba."}
                    </td>
                  </tr>
                ) : (
                  data.map((row) => (
                    <tr key={row.date} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                        {parseInt(row.date.split('-')[2], 10)}
                      </td>
                      {COLUMN_CONFIG.map(col => visibleColumns[col.key] && (
                        <td key={col.key} className="px-6 py-4 text-slate-600">
                          {col.key === 'moon_illumination' ? (
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-1 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-indigo-500" 
                                  style={{ width: row.moon_illumination }}
                                />
                              </div>
                              <span className="text-xs">{row.moon_illumination}</span>
                            </div>
                          ) : col.key === 'moon_phase' ? (
                            <div className="flex items-center" title={row.moon_phase}>
                              <span className="text-lg mr-2">{getMoonIcon(row.moon_phase)}</span>
                              <span className="text-xs max-w-[150px] truncate">{translatePhaseName(row.moon_phase)}</span>
                            </div>
                          ) : col.key === 'next_moon_phase' ? (
                            <span className="text-xs max-w-[150px] truncate" title={translateNextPhase(row.next_moon_phase)}>
                              {translateNextPhase(row.next_moon_phase)}
                            </span>
                          ) : col.key === 'day_length' || col.key === 'visible_light_length' ? (
                            <span className="font-medium text-slate-800 bg-orange-50/50 px-2 py-1 rounded">
                              {row[col.key]}
                            </span>
                          ) : (
                            row[col.key]
                          )}
                        </td>
                      ))}
                      {isAdminMode && (
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                            <div className="flex justify-end gap-2">
                                <button 
                                    onClick={() => openEditModal(row)}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                    title="Editar"
                                >
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => handleDeleteRecord(row.date)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                    title="Eliminar"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-900">
                        {data.find(d => d.date === editingRecord.date) ? 'Editar Registro' : 'Nuevo Registro'}
                    </h3>
                    <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <form onSubmit={(e) => { e.preventDefault(); handleSaveRecord(editingRecord); }} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Fecha (YYYY-MM-DD)</label>
                        <input 
                            type="date" 
                            required
                            value={editingRecord.date}
                            onChange={e => setEditingRecord({...editingRecord, date: e.target.value})}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                            disabled={!!data.find(d => d.date === editingRecord.date)} // Disable date edit for existing
                        />
                    </div>

                    {COLUMN_CONFIG.map(col => (
                        <div key={col.key}>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{col.label}</label>
                            <input 
                                type="text"
                                value={editingRecord[col.key as keyof DailyData] || ''}
                                onChange={e => setEditingRecord({...editingRecord, [col.key]: e.target.value})}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    ))}

                    <div className="col-span-2 mt-4 flex justify-end gap-3">
                        <button 
                            type="button"
                            onClick={() => setIsEditModalOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-medium flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            Guardar Cambios
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Debug Section */}
      <div className="mt-8 pt-8 border-t border-slate-200 text-center">
        <button 
            onClick={async () => {
                try {
                    const res = await fetch('/api/debug/dump');
                    const data = await res.json();
                    console.log("DB Dump:", data);
                    alert(JSON.stringify(data, null, 2));
                } catch (e) {
                    alert("Error debugging DB: " + e);
                }
            }}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
        >
            Debug DB (Ver primeros 10 registros)
        </button>
      </div>
    </div>
  );
}

