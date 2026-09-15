import fs from 'fs';
const file = 'src/components/Dashboard.tsx';
let code = fs.readFileSync(file, 'utf-8');

const correctImports = `import React, { useEffect, useState, useMemo } from 'react';
import type { User, Lead, ActivityLog, Attendance, Task } from '../types.ts';
import { Calendar, PhoneCall, CheckCircle, Clock, Activity, TrendingUp, Users, CalendarClock, Download, CheckSquare, Users as UsersIcon, Target, ClipboardList } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, Cell } from 'recharts';
import { useTheme } from '../context/ThemeContext.tsx';

interface DashboardProps {
`;

code = code.replace(/import React[\s\S]*?interface DashboardProps \{/, correctImports);

fs.writeFileSync(file, code);
console.log('Fixed imports in Dashboard');
