import React, { useState, useRef } from 'react';
import { useExam } from '../../context/ExamContext';
import { Profile } from '../../types';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/Table';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { useToast } from '../ui/Toast';
import {
  Users,
  UserPlus,
  UploadCloud,
  Download,
  Key,
  Pencil,
  Search,
} from 'lucide-react';

type StudentCredential = { student: Profile; initial_password: string };

export const StudentManager: React.FC = () => {
  const { students, addStudent, updateStudent, importStudentsCsv } = useExam();
  const { success, error: toastError } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Profile | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editRollNo, setEditRollNo] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [issuedCredentials, setIssuedCredentials] = useState<StudentCredential[]>([]);

  // Add individual student state
  const [fullName, setFullName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [email, setEmail] = useState('');

  // CSV Import state
  const [csvPreview, setCsvPreview] = useState<Array<{ roll_no: string; full_name: string; email: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredStudents = students.filter(
    s =>
      s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.roll_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenAdd = () => {
    const nextNum = students.length + 1;
    setFullName('');
    setRollNo(`CS2026-${nextNum.toString().padStart(3, '0')}`);
    setEmail(`student${nextNum}@bugbash.arena`);
    setIssuedCredentials([]);
    setAddModalOpen(true);
  };

  const handleOpenEdit = (student: Profile) => {
    setEditingStudent(student);
    setEditFullName(student.full_name);
    setEditRollNo(student.roll_no);
    setEditEmail(student.email);
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingStudent || !editFullName.trim() || !editRollNo.trim() || !editEmail.trim()) {
      toastError('Validation Error', 'All fields are mandatory.');
      return;
    }
    try {
      await updateStudent({
        ...editingStudent,
        full_name: editFullName.trim(),
        roll_no: editRollNo.trim(),
        email: editEmail.trim(),
      });
      success('Student Updated', `${editFullName.trim()}'s information was saved.`);
      setEditModalOpen(false);
    } catch (error) {
      toastError('Update Failed', error instanceof Error ? error.message : 'Could not update this student.');
    }
  };

  const handleSaveStudent = async () => {
    if (!fullName.trim() || !rollNo.trim() || !email.trim()) {
      toastError('Validation Error', 'All fields are mandatory.');
      return;
    }

    try {
      const credential = await addStudent({
        role: 'student',
        full_name: fullName,
        roll_no: rollNo,
        email,
      });
      setIssuedCredentials([credential]);
      success('Candidate Enrolled', `${fullName} (${rollNo}) was added to the competition roster.`);
      setAddModalOpen(false);
    } catch (e: any) {
      toastError('Enrollment Failed', e.message);
    }
  };

  // CSV file parse
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);
      const parsed: Array<{ roll_no: string; full_name: string; email: string }> = [];

      // Assume header: roll_no,full_name,email
      const startIndex = lines[0].toLowerCase().includes('roll') ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim());
        if (parts.length >= 3) {
          parsed.push({
            roll_no: parts[0],
            full_name: parts[1],
            email: parts[2],
          });
        }
      }

      setCsvPreview(parsed);
      setCsvModalOpen(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmCsvImport = async () => {
    if (csvPreview.length === 0) return;
    try {
      const credentials = await importStudentsCsv(csvPreview);
      setIssuedCredentials(credentials);
      success('CSV Import Complete', `Successfully imported ${credentials.length} candidates.`);
      setCsvModalOpen(false);
      setCsvPreview([]);
    } catch (e: any) {
      toastError('Import Failed', e.message);
    }
  };

  // Export roster to CSV
  const handleExportCsv = () => {
    const headers = 'roll_no,full_name,email,role\n';
    const rows = students.map(s => `${s.roll_no},"${s.full_name}",${s.email},student`).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bug_bash_candidates_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Student & Candidate Manager</h2>
            <p className="text-xs text-slate-400">
              Enroll candidates individually, import CSV rosters, and manage access credentials
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search candidate..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950/80 pl-9 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="gap-1.5 text-xs text-slate-300"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv,.txt"
            className="hidden"
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5 text-xs text-slate-300"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            Import CSV
          </Button>

          <Button
            size="sm"
            onClick={handleOpenAdd}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Enroll Student
          </Button>
        </div>
      </div>

      {issuedCredentials.length > 0 && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h3 className="flex items-center gap-2 font-semibold text-amber-200">
            <Key className="h-4 w-4" /> One-time student passwords
          </h3>
          <p className="mt-1 text-xs text-slate-400">Share these initial passwords securely. They are shown only until you leave or refresh this page.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500"><tr><th className="py-2 pr-3">Roll number</th><th className="py-2 pr-3">Student</th><th className="py-2 pr-3">Email</th><th className="py-2">Initial password</th></tr></thead>
              <tbody>{issuedCredentials.map(({ student, initial_password }) => (
                <tr key={student.id} className="border-t border-slate-800">
                  <td className="py-2 pr-3 font-mono">{student.roll_no}</td>
                  <td className="py-2 pr-3">{student.full_name}</td>
                  <td className="py-2 pr-3">{student.email}</td>
                  <td className="py-2 font-mono text-amber-200">{initial_password}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}

      {/* Candidates Roster Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Roll Number</TableHead>
            <TableHead>Candidate Name</TableHead>
            <TableHead>Email Address</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredStudents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-slate-400 text-xs">
                No candidates enrolled. Click "Enroll Student" or "Import CSV" above.
              </TableCell>
            </TableRow>
          ) : (
            filteredStudents.map(st => (
              <TableRow key={st.id}>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs">
                    {st.roll_no}
                  </Badge>
                </TableCell>
                <TableCell className="font-semibold text-white">{st.full_name}</TableCell>
                <TableCell className="text-slate-300 text-xs font-mono">{st.email}</TableCell>
                <TableCell>
                  <Badge variant="purple" className="text-[10px]">
                    Candidate
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => handleOpenEdit(st)} className="gap-1.5 text-xs">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* ADD CANDIDATE MODAL */}
      <Dialog
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        title="Enroll Individual Candidate"
        description="Provide student details. Login credentials will be generated automatically."
      >
        <div className="space-y-4 pt-2">
          <Input
            label="Full Name"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="e.g. Maya Lin"
          />
          <Input
            label="Roll Number / Student ID"
            value={rollNo}
            onChange={e => setRollNo(e.target.value)}
            placeholder="e.g. CS2026-006"
          />
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="e.g. maya@example.com"
          />

          <div className="rounded-lg bg-slate-950 p-3 border border-slate-800 text-xs space-y-1">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Initial Login Credentials</span>
            <p className="text-slate-200">
              Username/Email: <strong>{email || '...'}</strong>
            </p>
            <p className="text-slate-400">
              A unique temporary password will be generated and shown once after enrollment.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="ghost" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold" onClick={handleSaveStudent}>
              Enroll Candidate
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        title="Edit Student Information"
        description="Changes are saved to MongoDB and immediately update the roster."
      >
        <div className="space-y-4 pt-2">
          <Input label="Full Name" value={editFullName} onChange={event => setEditFullName(event.target.value)} />
          <Input label="Roll Number / Student ID" value={editRollNo} onChange={event => setEditRollNo(event.target.value)} />
          <Input label="Email Address" type="email" value={editEmail} onChange={event => setEditEmail(event.target.value)} />
          <div className="flex justify-end gap-3 pt-3">
            <Button variant="ghost" onClick={() => setEditModalOpen(false)}>Cancel</Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => void handleSaveEdit()}>Save Changes</Button>
          </div>
        </div>
      </Dialog>

      {/* CSV IMPORT PREVIEW MODAL */}
      <Dialog
        open={csvModalOpen}
        onOpenChange={setCsvModalOpen}
        title="CSV Candidate Import Preview"
        description={`Parsed ${csvPreview.length} candidate records from CSV.`}
        className="max-w-2xl"
      >
        <div className="space-y-4 pt-2">
          <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-800">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Roll No</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {csvPreview.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-xs">{item.roll_no}</TableCell>
                    <TableCell className="text-xs font-semibold text-white">{item.full_name}</TableCell>
                    <TableCell className="text-xs text-slate-300 font-mono">{item.email}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setCsvModalOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold" onClick={handleConfirmCsvImport}>
              Import All Candidates
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
