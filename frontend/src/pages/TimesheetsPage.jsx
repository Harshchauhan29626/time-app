import { useEffect, useState } from 'react';
import api from '../api/client';
import dayjs from 'dayjs';

export default function TimesheetsPage() {
  const [range, setRange] = useState('week');
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api.get(`/time-entries?range=${range}&page=1&pageSize=20`).then((res) => setRows(res.data.data));
  }, [range]);

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm">
      <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-semibold">Timesheets</h2><select className="border rounded p-2" value={range} onChange={(e) => setRange(e.target.value)}><option value="today">today</option><option value="week">this week</option><option value="month">this month</option></select></div>
      <table className="w-full text-sm"><thead><tr className="text-left border-b"><th>Date</th><th>Clock In</th><th>Clock Out</th><th>Worked</th><th>Break</th><th>Overtime</th><th>Status</th></tr></thead><tbody>{rows.map((r)=><tr key={r.id} className="border-b"><td>{dayjs(r.clockIn).format('YYYY-MM-DD')}</td><td>{dayjs(r.clockIn).format('HH:mm')}</td><td>{r.clockOut ? dayjs(r.clockOut).format('HH:mm') : '-'}</td><td>{(r.workedMinutes/60).toFixed(2)}h</td><td>{(r.breakMinutes/60).toFixed(2)}h</td><td>{(r.overtimeMinutes/60).toFixed(2)}h</td><td>{r.status}</td></tr>)}</tbody></table>
    </div>
  );
}
