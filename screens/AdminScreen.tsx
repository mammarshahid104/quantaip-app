import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import {pick, types} from '@react-native-documents/picker';
import * as XLSX from 'xlsx';
import {
  HomeIcon,
  AcademicCapIcon,
  UserGroupIcon,
  UserIcon,
  BanknotesIcon,
  ArrowUpTrayIcon,
  PlusCircleIcon,
  ArrowRightOnRectangleIcon,
  BuildingLibraryIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  KeyIcon,
} from 'react-native-heroicons/outline';
import ClassesScreen from './ClassesScreen';
import FeeScreen from './FeeScreen';

const SCHOOL_CODE = 'GHS-001';

const CLASS_HIERARCHY = [
  {category: 'Early Education', classes: ['Nursery', 'Prep', 'KG']},
  {category: 'Primary', classes: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5']},
  {category: 'Middle', classes: ['Grade 6', 'Grade 7', 'Grade 8']},
  {category: 'Secondary', classes: ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']},
];

const generateId = (role: string, index: number): string => {
  const roleCode: any = {teacher: 'TCH', student: 'STU', parent: 'PAR'};
  const num = String(index).padStart(4, '0');
  return `${SCHOOL_CODE}-${roleCode[role]}-${num}`;
};

const generatePass = (name: string): string => {
  const first = name.split(' ')[0];
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `${first}${num}`;
};

const TABS = [
  {key: 'Dashboard', icon: HomeIcon},
  {key: 'Classes', icon: BuildingLibraryIcon},
  {key: 'Students', icon: UserGroupIcon},
  {key: 'Teachers', icon: AcademicCapIcon},
  {key: 'Fee', icon: BanknotesIcon},
  {key: 'Import', icon: ArrowUpTrayIcon},
];

export default function AdminScreen({navigation}: any) {
  const [tab, setTab] = useState('Dashboard');
  const [loading, setLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');
  const [importProgress, setImportProgress] = useState('');
  const [stats, setStats] = useState({students: 0, teachers: 0, fee: '0'});

  // Student list
  const [studentList, setStudentList] = useState<any[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [credModal, setCredModal] = useState<any>(null);

  // Teacher list
  const [teacherList, setTeacherList] = useState<any[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [teacherModal, setTeacherModal] = useState<any>(null);

  // Student sub tab
  const [studentTab, setStudentTab] = useState('List');
  const [teacherTab, setTeacherTab] = useState('List');

  // Add Student form
  const [sName, setSName] = useState('');
  const [sFatherName, setSFatherName] = useState('');
  const [sSection, setSSection] = useState('');
  const [sRollNo, setSRollNo] = useState('');
  const [sDob, setSdob] = useState('');
  const [sParentPhone, setSParentPhone] = useState('');

  // Add Teacher form
  const [tName, setTName] = useState('');
  const [tSubject, setTSubject] = useState('');
  const [tPhone, setTPhone] = useState('');
  const [tClasses, setTClasses] = useState('');

  useEffect(() => {loadStats();}, []);

  const loadStats = async () => {
    try {
      const [sSnap, tSnap, feeSnap] = await Promise.all([
        firestore().collection('schools').doc(SCHOOL_CODE).collection('students').get(),
        firestore().collection('schools').doc(SCHOOL_CODE).collection('teachers').get(),
        firestore().collection('schools').doc(SCHOOL_CODE).collection('fees')
          .doc(new Date().toLocaleString('default', {month: 'long', year: 'numeric'}))
          .collection('students').where('status', '==', 'paid').get(),
      ]);
      let totalFee = 0;
      feeSnap.docs.forEach(d => {totalFee += d.data().amount || 0;});
      const feeFormatted = totalFee >= 1000000
        ? `${(totalFee / 1000000).toFixed(1)}M`
        : totalFee >= 1000
        ? `${(totalFee / 1000).toFixed(0)}K`
        : totalFee.toString();
      setStats({students: sSnap.size, teachers: tSnap.size, fee: feeFormatted});
    } catch (e) {}
  };

    const loadStudents = async () => {
    setLoadingStudents(true);
    try {
      const snap = await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('students').get();
      setStudentList(snap.docs.map(d => d.data()));
    } catch (e) {} finally {setLoadingStudents(false);}
  };

  const loadTeachers = async () => {
    setLoadingTeachers(true);
    try {
      const snap = await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('teachers').get();
      setTeacherList(snap.docs.map(d => d.data()));
    } catch (e) {} finally {setLoadingTeachers(false);}
  };

  useEffect(() => {
    if (tab === 'Students') loadStudents();
    if (tab === 'Teachers') loadTeachers();
  }, [tab]);

  const STAT_CARDS = [
    {val: stats.students.toString(), lbl: 'Students', color: '#7c3aed', bg: '#f5f3ff', Icon: UserGroupIcon},
    {val: stats.teachers.toString(), lbl: 'Teachers', color: '#0891b2', bg: '#ecfeff', Icon: AcademicCapIcon},
    {val: '91%', lbl: 'Attendance', color: '#16a34a', bg: '#f0fdf4', Icon: ChartBarIcon},
    {val: stats.fee, lbl: 'PKR Fees', color: '#ea580c', bg: '#fff7ed', Icon: BanknotesIcon},
  ];

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const addStudent = async () => {
    if (!sName || !selectedClass || !sSection) {
      Alert.alert('Error', 'Name, Class and Section are required');
      return;
    }
    setLoading(true);
    try {
      const snapshot = await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('students').get();

      const index = snapshot.size + 1;
      const studentId = generateId('student', index);
      const parentId = generateId('parent', index);
      const studentPass = generatePass(sName);
      const parentPass = generatePass(sName + ' Parent');

      await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('students').doc(studentId)
        .set({
          id: studentId, fullName: sName, fatherName: sFatherName,
          class: selectedClass, section: sSection, rollNo: sRollNo,
          dob: sDob, parentPhone: sParentPhone, parentId,
          password: studentPass, role: 'student',
          school: SCHOOL_CODE, status: 'active',
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('parents').doc(parentId)
        .set({
          id: parentId, studentId, studentName: sName,
          phone: sParentPhone, password: parentPass,
          role: 'parent', school: SCHOOL_CODE,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      await auth().createUserWithEmailAndPassword(
        `${studentId.toLowerCase()}@quantaip.edu.pk`, studentPass);
      await auth().createUserWithEmailAndPassword(
        `${parentId.toLowerCase()}@quantaip.edu.pk`, parentPass);

      setStats(prev => ({...prev, students: prev.students + 1}));
      Alert.alert('Student Added ✅',
        `STUDENT\nID: ${studentId}\nPassword: ${studentPass}\n\nPARENT\nID: ${parentId}\nPassword: ${parentPass}`);

      setSName(''); setSFatherName(''); setSSection('');
      setSRollNo(''); setSdob(''); setSParentPhone('');
      setSelectedClass('');
      loadStudents();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {setLoading(false);}
  };

  const addTeacher = async () => {
    if (!tName || !tSubject) {
      Alert.alert('Error', 'Name and Subject are required');
      return;
    }
    setLoading(true);
    try {
      const snapshot = await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('teachers').get();

      const index = snapshot.size + 1;
      const teacherId = generateId('teacher', index);
      const defaultPass = generatePass(tName);

      await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('teachers').doc(teacherId)
        .set({
          id: teacherId, name: tName, subject: tSubject,
          phone: tPhone,
          classesAssigned: tClasses.split(',').map((c: string) => c.trim()).filter(Boolean),
          password: defaultPass, role: 'teacher',
          school: SCHOOL_CODE,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      await auth().createUserWithEmailAndPassword(
        `${teacherId.toLowerCase()}@quantaip.edu.pk`, defaultPass);

      setStats(prev => ({...prev, teachers: prev.teachers + 1}));
      Alert.alert('Teacher Added ✅',
        `ID: ${teacherId}\nPassword: ${defaultPass}`);

      setTName(''); setTSubject(''); setTPhone(''); setTClasses('');
      loadTeachers();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {setLoading(false);}
  };

  const importFromExcel = async () => {
    try {
      setImportProgress('Opening file picker...');
      const [result] = await pick({
        allowMultiSelection: false,
        type: [types.xlsx, types.xls],
      });

      setImportProgress('Reading Excel file...');
      const response = await fetch(result.uri);
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, {type: 'array'});

      let totalSuccess = 0;
      let totalError = 0;

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data: any[] = XLSX.utils.sheet_to_json(sheet);
        if (data.length === 0) continue;

        setImportProgress(`Importing ${sheetName}... (${data.length} rows)`);
        const isTeacher = sheetName.toLowerCase().includes('teacher');
        const collection = isTeacher ? 'teachers' : 'students';

        const snapshot = await firestore()
          .collection('schools').doc(SCHOOL_CODE)
          .collection(collection).get();

        let currentIndex = snapshot.size;

        for (const row of data) {
          try {
            currentIndex++;
            const name = row['Name'] || row['name'] || '';
            if (!name) continue;
            const defaultPass = generatePass(name);

            if (isTeacher) {
              const teacherId = generateId('teacher', currentIndex);
              await firestore()
                .collection('schools').doc(SCHOOL_CODE)
                .collection('teachers').doc(teacherId)
                .set({
                  id: teacherId, name,
                  subject: row['Subject'] || '',
                  phone: row['Phone'] || '',
                  classesAssigned: (row['Classes Assigned'] || '').split(',').map((c: string) => c.trim()).filter(Boolean),
                  password: defaultPass, role: 'teacher',
                  school: SCHOOL_CODE,
                  createdAt: firestore.FieldValue.serverTimestamp(),
                });
              await auth().createUserWithEmailAndPassword(
                `${teacherId.toLowerCase()}@quantaip.edu.pk`, defaultPass);
            } else {
              const studentId = generateId('student', currentIndex);
              const parentId = generateId('parent', currentIndex);
              const parentPass = generatePass(name + ' Parent');

              await firestore()
                .collection('schools').doc(SCHOOL_CODE)
                .collection('students').doc(studentId)
                .set({
                  id: studentId, fullName: name,
                  fatherName: row['Father Name'] || '',
                  class: sheetName,
                  section: row['Section'] || 'A',
                  rollNo: row['Roll No'] || '',
                  parentPhone: row['Parent Phone'] || '',
                  parentId, password: defaultPass,
                  role: 'student', school: SCHOOL_CODE,
                  status: 'active',
                  createdAt: firestore.FieldValue.serverTimestamp(),
                });

              await firestore()
                .collection('schools').doc(SCHOOL_CODE)
                .collection('parents').doc(parentId)
                .set({
                  id: parentId, studentId, studentName: name,
                  phone: row['Parent Phone'] || '',
                  password: parentPass, role: 'parent',
                  school: SCHOOL_CODE,
                  createdAt: firestore.FieldValue.serverTimestamp(),
                });

              await auth().createUserWithEmailAndPassword(
                `${studentId.toLowerCase()}@quantaip.edu.pk`, defaultPass);
              await auth().createUserWithEmailAndPassword(
                `${parentId.toLowerCase()}@quantaip.edu.pk`, parentPass);
            }
            totalSuccess++;
            setImportProgress(`Importing... ${totalSuccess} done`);
          } catch (e) {totalError++;}
        }
      }

      setImportProgress(`Done! ${totalSuccess} imported, ${totalError} errors.`);
      Alert.alert('Import Complete ✅', `${totalSuccess} records imported!\n${totalError} errors.`);
      loadStats();
    } catch (e: any) {
      setImportProgress('');
      if (e?.code !== 'OPERATION_CANCELED') Alert.alert('Error', e.message);
    }
  };

  const downloadTemplate = async () => {
    try {
      const RNBlobUtil = require('react-native-blob-util').default;
      const wb = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Name', 'Subject', 'Phone', 'Classes Assigned'],
        ['Mr. Qaiser', 'Mathematics', '0300-1234567', 'Grade 9, Grade 10'],
      ]), 'Teachers');

      const classData = [
        ['Name', 'Father Name', 'Section', 'Roll No', 'Parent Phone'],
        ['Ayesha Khan', 'Mr. Khan', 'A', '001', '0300-1234567'],
      ];
      CLASS_HIERARCHY.flatMap(c => c.classes).forEach(cls => {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(classData), cls);
      });

      const wbout = XLSX.write(wb, {type: 'base64', bookType: 'xlsx'});
      const path = `${RNBlobUtil.fs.dirs.CacheDir}/QUANTAIP_Template.xlsx`;
      await RNBlobUtil.fs.writeFile(path, wbout, 'base64');
      await RNBlobUtil.android.actionViewIntent(path,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  // Group students by category
  const filteredStudents = studentList.filter(s =>
    (s.fullName || s.name || '').toLowerCase().includes(studentSearch.toLowerCase()) ||
    (s.id || '').toLowerCase().includes(studentSearch.toLowerCase())
  );

  const groupedStudents = CLASS_HIERARCHY.map(cat => ({
    category: cat.category,
    classes: cat.classes.map(cls => ({
      className: cls,
      students: filteredStudents.filter(s => s.class === cls),
    })).filter(c => c.students.length > 0),
  })).filter(cat => cat.classes.length > 0);

  return (
    <View style={styles.root}>

      {/* CREDENTIALS MODAL */}
      <Modal visible={!!credModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{credModal?.fullName || credModal?.name}</Text>
              <TouchableOpacity onPress={() => setCredModal(null)}>
                <XMarkIcon size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>
            {[
              {label: 'Student ID', value: credModal?.id},
              {label: 'Password', value: credModal?.password || 'Not saved', highlight: true},
              {label: 'Class', value: `${credModal?.class} — ${credModal?.section}`},
              {label: 'Father', value: credModal?.fatherName || 'N/A'},
              {label: 'Parent ID', value: credModal?.parentId || 'N/A'},
              {label: 'Phone', value: credModal?.parentPhone || 'N/A'},
            ].map((row, i) => (
              <View key={i} style={styles.modalRow}>
                <Text style={styles.modalLabel}>{row.label}</Text>
                <Text style={[styles.modalValue, row.highlight && styles.modalHighlight]}>
                  {row.value}
                </Text>
              </View>
            ))}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setCredModal(null)}>
              <Text style={styles.modalCloseTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* TEACHER MODAL */}
      <Modal visible={!!teacherModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{teacherModal?.name}</Text>
              <TouchableOpacity onPress={() => setTeacherModal(null)}>
                <XMarkIcon size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>
            {[
              {label: 'Teacher ID', value: teacherModal?.id},
              {label: 'Password', value: teacherModal?.password || 'Not saved', highlight: true},
              {label: 'Subject', value: teacherModal?.subject},
              {label: 'Phone', value: teacherModal?.phone || 'N/A'},
              {label: 'Classes', value: teacherModal?.classesAssigned?.join(', ') || 'N/A'},
            ].map((row, i) => (
              <View key={i} style={styles.modalRow}>
                <Text style={styles.modalLabel}>{row.label}</Text>
                <Text style={[styles.modalValue, row.highlight && styles.modalHighlight]}>
                  {row.value}
                </Text>
              </View>
            ))}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setTeacherModal(null)}>
              <Text style={styles.modalCloseTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* NAVBAR */}
      <View style={styles.navbar}>
        <Text style={styles.brand}>QUANT<Text style={styles.brandAccent}>AIP</Text></Text>
        <TouchableOpacity onPress={() => {auth().signOut(); navigation.navigate('Login');}}>
          <ArrowRightOnRectangleIcon size={22} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      {/* TABS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.tabScroll} contentContainerStyle={styles.tabRow}>
        {TABS.map(({key, icon: TabIcon}) => (
          <TouchableOpacity key={key}
            style={[styles.tab, tab === key && styles.tabOn]}
            onPress={() => setTab(key)}>
            <TabIcon size={16} color={tab === key ? '#7c3aed' : '#9ca3af'} />
            <Text style={[styles.tabTxt, tab === key && styles.tabTxtOn]}>{key}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content}>

        {/* DASHBOARD */}
        {tab === 'Dashboard' && (
          <View>
            <View style={styles.welcomeCard}>
              <Text style={styles.welcomeEye}>DASHBOARD</Text>
              <Text style={styles.welcomeTitle}>Good morning, <Text style={styles.welcomeAccent}>Admin</Text></Text>
              <Text style={styles.welcomeSub}>School Code: {SCHOOL_CODE}</Text>
            </View>
            <View style={styles.statsGrid}>
              {STAT_CARDS.map((s, i) => (
                <View key={i} style={[styles.statCard, {backgroundColor: s.bg, borderColor: s.color + '33'}]}>
                  <s.Icon size={20} color={s.color} />
                  <Text style={[styles.statVal, {color: s.color}]}>{s.val}</Text>
                  <Text style={styles.statLbl}>{s.lbl}</Text>
                </View>
              ))}
            </View>
            <View style={styles.quickGrid}>
              {[
                {label: 'Add Student', icon: UserIcon, tabKey: 'Students', color: '#7c3aed'},
                {label: 'Add Teacher', icon: AcademicCapIcon, tabKey: 'Teachers', color: '#0891b2'},
                {label: 'Import Data', icon: ArrowUpTrayIcon, tabKey: 'Import', color: '#16a34a'},
                {label: 'Fee Management', icon: BanknotesIcon, tabKey: 'Fee', color: '#ea580c'},
              ].map((item, i) => (
                <TouchableOpacity key={i} style={styles.quickBtn} onPress={() => setTab(item.tabKey)}>
                  <View style={[styles.quickIconBox, {backgroundColor: item.color + '15'}]}>
                    <item.icon size={22} color={item.color} />
                  </View>
                  <Text style={styles.quickLbl}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* CLASSES */}
        {tab === 'Classes' && <ClassesScreen />}

        {/* STUDENTS */}
        {tab === 'Students' && (
          <View>
            <View style={styles.subTabRow}>
              {['List', 'Add New'].map(t => (
                <TouchableOpacity key={t}
                  style={[styles.subTab, studentTab === t && styles.subTabOn]}
                  onPress={() => setStudentTab(t)}>
                  <Text style={[styles.subTabTxt, studentTab === t && styles.subTabTxtOn]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {studentTab === 'List' && (
              <View>
                <View style={styles.searchRow}>
                  <MagnifyingGlassIcon size={18} color="#9ca3af" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name or ID..."
                    placeholderTextColor="#c4b5fd"
                    value={studentSearch}
                    onChangeText={setStudentSearch}
                  />
                </View>

                {loadingStudents ? (
                  <ActivityIndicator color="#7c3aed" size="large" style={{marginTop: 30}} />
                ) : groupedStudents.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <UserGroupIcon size={40} color="#c4b5fd" />
                    <Text style={styles.emptyTxt}>No students found</Text>
                  </View>
                ) : (
                  groupedStudents.map((cat, ci) => (
                    <View key={ci} style={styles.categoryBlock}>
                      <TouchableOpacity
                        style={styles.categoryHeader}
                        onPress={() => toggleCategory(cat.category)}>
                        <Text style={styles.categoryTitle}>{cat.category}</Text>
                        <View style={styles.categoryRight}>
                          <Text style={styles.categoryCount}>
                            {cat.classes.reduce((sum, c) => sum + c.students.length, 0)} students
                          </Text>
                          {expandedCategories.includes(cat.category)
                            ? <ChevronDownIcon size={16} color="#7c3aed" />
                            : <ChevronRightIcon size={16} color="#7c3aed" />}
                        </View>
                      </TouchableOpacity>

                      {expandedCategories.includes(cat.category) && cat.classes.map((cls, cli) => (
                        <View key={cli} style={styles.classBlock}>
                          <Text style={styles.classBlockTitle}>
                            {cls.className} ({cls.students.length})
                          </Text>
                          {cls.students.map((s, si) => (
                            <TouchableOpacity key={si}
                              style={styles.studentCard}
                              onPress={() => setCredModal(s)}>
                              <View style={styles.studentCardLeft}>
                                <View style={styles.studentAv}>
                                  <Text style={styles.studentAvTxt}>
                                    {(s.fullName || s.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                  </Text>
                                </View>
                                <View>
                                  <Text style={styles.studentName}>{s.fullName || s.name}</Text>
                                  <Text style={styles.studentMeta}>Roll {s.rollNo || 'N/A'} · {s.id}</Text>
                                </View>
                              </View>
                              <KeyIcon size={16} color="#c4b5fd" />
                            </TouchableOpacity>
                          ))}
                        </View>
                      ))}
                    </View>
                  ))
                )}
              </View>
            )}

            {studentTab === 'Add New' && (
              <View>
                <Text style={styles.fieldLabel}>SELECT CLASS *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 12}}>
                  {CLASS_HIERARCHY.flatMap(c => c.classes).map((cls, i) => (
                    <TouchableOpacity key={i}
                      style={[styles.clsChip, selectedClass === cls && styles.clsChipOn]}
                      onPress={() => setSelectedClass(cls)}>
                      <Text style={[styles.clsChipTxt, selectedClass === cls && styles.clsChipTxtOn]}>{cls}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={styles.card}>
                  {[
                    {label: 'FULL NAME *', value: sName, setter: setSName, placeholder: 'e.g. Ayesha Khan'},
                    {label: 'FATHER NAME', value: sFatherName, setter: setSFatherName, placeholder: 'e.g. Mr. Ahmed Khan'},
                    {label: 'SECTION *', value: sSection, setter: setSSection, placeholder: 'e.g. A or Red'},
                    {label: 'ROLL NUMBER', value: sRollNo, setter: setSRollNo, placeholder: 'e.g. 001', keyboard: 'number-pad'},
                    {label: 'DATE OF BIRTH', value: sDob, setter: setSdob, placeholder: 'e.g. 2010-05-15'},
                    {label: 'PARENT PHONE', value: sParentPhone, setter: setSParentPhone, placeholder: 'e.g. 0300-1234567', keyboard: 'phone-pad'},
                  ].map((field, i) => (
                    <View key={i} style={i > 0 ? {marginTop: 12} : {}}>
                      <Text style={styles.fieldLabel}>{field.label}</Text>
                      <TextInput style={styles.input}
                        placeholder={field.placeholder}
                        placeholderTextColor="#c4b5fd"
                        value={field.value}
                        onChangeText={field.setter}
                        keyboardType={(field as any).keyboard || 'default'}
                      />
                    </View>
                  ))}
                  {selectedClass ? (
                    <View style={styles.selectedBadge}>
                      <AcademicCapIcon size={14} color="#16a34a" />
                      <Text style={styles.selectedBadgeTxt}>{selectedClass} — Section: {sSection || '?'}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.addBtn, !selectedClass && styles.addBtnDisabled]}
                    onPress={addStudent} disabled={loading || !selectedClass}>
                    {loading ? <ActivityIndicator color="#ffffff" /> :
                      <View style={styles.btnInner}>
                        <PlusCircleIcon size={18} color="#ffffff" />
                        <Text style={styles.addBtnTxt}>Add Student & Generate ID</Text>
                      </View>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* TEACHERS */}
        {tab === 'Teachers' && (
          <View>
            <View style={styles.subTabRow}>
              {['List', 'Add New'].map(t => (
                <TouchableOpacity key={t}
                  style={[styles.subTab, teacherTab === t && styles.subTabOn]}
                  onPress={() => setTeacherTab(t)}>
                  <Text style={[styles.subTabTxt, teacherTab === t && styles.subTabTxtOn]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {teacherTab === 'List' && (
              <View>
                {loadingTeachers ? (
                  <ActivityIndicator color="#7c3aed" size="large" style={{marginTop: 30}} />
                ) : teacherList.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <AcademicCapIcon size={40} color="#c4b5fd" />
                    <Text style={styles.emptyTxt}>No teachers added yet</Text>
                  </View>
                ) : (
                  teacherList.map((t, i) => (
                    <TouchableOpacity key={i} style={styles.studentCard}
                      onPress={() => setTeacherModal(t)}>
                      <View style={styles.studentCardLeft}>
                        <View style={[styles.studentAv, {backgroundColor: '#ecfeff', borderColor: '#0891b2'}]}>
                          <Text style={[styles.studentAvTxt, {color: '#0891b2'}]}>
                            {(t.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.studentName}>{t.name}</Text>
                          <Text style={styles.studentMeta}>{t.subject} · {t.id}</Text>
                          {t.classesAssigned?.length > 0 && (
                            <Text style={styles.studentMeta}>Classes: {t.classesAssigned.join(', ')}</Text>
                          )}
                        </View>
                      </View>
                      <KeyIcon size={16} color="#c4b5fd" />
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {teacherTab === 'Add New' && (
              <View>
                <View style={styles.card}>
                  {[
                    {label: 'FULL NAME *', value: tName, setter: setTName, placeholder: 'e.g. Mr. Qaiser'},
                    {label: 'SUBJECT *', value: tSubject, setter: setTSubject, placeholder: 'e.g. Mathematics'},
                    {label: 'PHONE', value: tPhone, setter: setTPhone, placeholder: 'e.g. 0300-1234567', keyboard: 'phone-pad'},
                  ].map((field, i) => (
                    <View key={i} style={i > 0 ? {marginTop: 12} : {}}>
                      <Text style={styles.fieldLabel}>{field.label}</Text>
                      <TextInput style={styles.input}
                        placeholder={field.placeholder}
                        placeholderTextColor="#c4b5fd"
                        value={field.value}
                        onChangeText={field.setter}
                        keyboardType={(field as any).keyboard || 'default'}
                      />
                    </View>
                  ))}
                  <View style={{marginTop: 12}}>
                    <Text style={styles.fieldLabel}>CLASSES ASSIGNED</Text>
                    <TextInput style={styles.input}
                      placeholder="e.g. Grade 9, Grade 10, Grade 11"
                      placeholderTextColor="#c4b5fd"
                      value={tClasses}
                      onChangeText={setTClasses}
                    />
                    <Text style={styles.inputHint}>Separate multiple classes with commas</Text>
                  </View>
                  <TouchableOpacity style={[styles.addBtn, {backgroundColor: '#0891b2'}]}
                    onPress={addTeacher} disabled={loading}>
                    {loading ? <ActivityIndicator color="#ffffff" /> :
                      <View style={styles.btnInner}>
                        <PlusCircleIcon size={18} color="#ffffff" />
                        <Text style={styles.addBtnTxt}>Add Teacher & Generate ID</Text>
                      </View>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* FEE */}
        {tab === 'Fee' && <FeeScreen />}

        {/* IMPORT */}
        {tab === 'Import' && (
          <View>
            <Text style={styles.sectionTitle}>Import from Excel</Text>
            <View style={styles.card}>
              <Text style={styles.importTitle}>Bulk Import</Text>
              <Text style={styles.importDesc}>
                Upload Excel file. Each sheet = one class. "Teachers" sheet = teachers.
              </Text>
              <View style={styles.excelFormat}>
                <Text style={styles.excelFormatTitle}>Excel Sheet Structure:</Text>
                <Text style={styles.excelCol}>• Sheet "Teachers": Name, Subject, Phone, Classes Assigned</Text>
                <Text style={styles.excelCol}>• Sheet "Grade 9": Name, Father Name, Section, Roll No, Parent Phone</Text>
              </View>
              {importProgress ? (
                <View style={styles.progressBox}>
                  <ActivityIndicator size="small" color="#16a34a" style={{marginRight: 8}} />
                  <Text style={styles.progressTxt}>{importProgress}</Text>
                </View>
              ) : null}
              <TouchableOpacity style={[styles.addBtn, {backgroundColor: '#16a34a'}]} onPress={importFromExcel}>
                <View style={styles.btnInner}>
                  <ArrowUpTrayIcon size={18} color="#ffffff" />
                  <Text style={styles.addBtnTxt}>Select Excel File & Import</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.addBtn, {backgroundColor: '#0891b2', marginTop: 10}]} onPress={downloadTemplate}>
                <View style={styles.btnInner}>
                  <ArrowUpTrayIcon size={18} color="#ffffff" />
                  <Text style={styles.addBtnTxt}>Download Excel Template</Text>
                </View>
              </TouchableOpacity>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoTxt}>Download template → fill data → import.</Text>
            </View>
          </View>
        )}

        <View style={{height: 30}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#faf5ff'},
  navbar: {
    backgroundColor: '#1e1b4b', paddingTop: 50, paddingBottom: 16,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {fontSize: 20, fontWeight: '700', color: '#ffffff', letterSpacing: 2},
  brandAccent: {color: '#a78bfa'},
  tabScroll: {backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#ede9fe', maxHeight: 48},
  tabRow: {paddingHorizontal: 4},
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabOn: {borderBottomColor: '#7c3aed'},
  tabTxt: {fontSize: 12, fontWeight: '500', color: '#9ca3af'},
  tabTxtOn: {color: '#7c3aed', fontWeight: '700'},
  content: {flex: 1, paddingHorizontal: 14, paddingTop: 14},
  welcomeCard: {backgroundColor: '#1e1b4b', borderRadius: 16, padding: 20, marginBottom: 16},
  welcomeEye: {fontSize: 10, letterSpacing: 4, color: '#a78bfa', fontWeight: '600', marginBottom: 6},
  welcomeTitle: {fontSize: 22, fontWeight: '700', color: '#ffffff', marginBottom: 4},
  welcomeAccent: {color: '#a78bfa'},
  welcomeSub: {fontSize: 13, color: 'rgba(255,255,255,0.6)'},
  statsGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16},
  statCard: {width: '47%', borderRadius: 12, padding: 14, borderWidth: 1, gap: 6},
  statVal: {fontSize: 26, fontWeight: '700'},
  statLbl: {fontSize: 12, color: '#6b7280', fontWeight: '500'},
  quickGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16},
  quickBtn: {width: '47%', backgroundColor: '#ffffff', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#ede9fe', gap: 10},
  quickIconBox: {width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  quickLbl: {fontSize: 13, fontWeight: '600', color: '#1e1b4b', textAlign: 'center'},
  subTabRow: {flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 12, padding: 4, marginBottom: 14, borderWidth: 1, borderColor: '#ede9fe'},
  subTab: {flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10},
  subTabOn: {backgroundColor: '#7c3aed'},
  subTabTxt: {fontSize: 13, fontWeight: '500', color: '#9ca3af'},
  subTabTxtOn: {color: '#ffffff', fontWeight: '700'},
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#ffffff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#ede9fe', marginBottom: 12,
  },
  searchInput: {flex: 1, fontSize: 14, color: '#1e1b4b'},
  emptyBox: {alignItems: 'center', paddingVertical: 40, gap: 10},
  emptyTxt: {fontSize: 14, color: '#9ca3af', fontWeight: '500'},
  categoryBlock: {marginBottom: 8},
  categoryHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#ffffff', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#ede9fe', marginBottom: 4,
  },
  categoryTitle: {fontSize: 15, fontWeight: '700', color: '#1e1b4b'},
  categoryRight: {flexDirection: 'row', alignItems: 'center', gap: 8},
  categoryCount: {fontSize: 12, color: '#7c3aed', fontWeight: '600'},
  classBlock: {marginLeft: 12, marginBottom: 6},
  classBlockTitle: {
    fontSize: 12, fontWeight: '700', color: '#6b7280',
    letterSpacing: 1, textTransform: 'uppercase',
    marginBottom: 6, marginTop: 4,
  },
  studentCard: {
    backgroundColor: '#ffffff', borderRadius: 10, padding: 12,
    marginBottom: 6, borderWidth: 1, borderColor: '#ede9fe',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  studentCardLeft: {flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1},
  studentAv: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#f5f3ff', borderWidth: 1.5, borderColor: '#7c3aed',
    alignItems: 'center', justifyContent: 'center',
  },
  studentAvTxt: {fontSize: 11, fontWeight: '700', color: '#7c3aed'},
  studentName: {fontSize: 13, fontWeight: '600', color: '#1e1b4b'},
  studentMeta: {fontSize: 11, color: '#9ca3af', marginTop: 1},
  sectionTitle: {fontSize: 17, fontWeight: '700', color: '#1e1b4b', marginBottom: 10},
  fieldLabel: {fontSize: 11, fontWeight: '600', color: '#7c3aed', letterSpacing: 2, marginBottom: 8},
  clsChip: {borderWidth: 1, borderColor: '#ede9fe', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#ffffff', marginRight: 6},
  clsChipOn: {borderColor: '#7c3aed', backgroundColor: '#f5f3ff'},
  clsChipTxt: {fontSize: 12, fontWeight: '500', color: '#6b7280'},
  clsChipTxtOn: {color: '#7c3aed', fontWeight: '700'},
  card: {backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#ede9fe'},
  input: {backgroundColor: '#f5f3ff', borderWidth: 1.5, borderColor: '#ede9fe', borderRadius: 10, padding: 13, fontSize: 14, color: '#1e1b4b', fontWeight: '500'},
  inputHint: {fontSize: 11, color: '#9ca3af', marginTop: 4},
  selectedBadge: {flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0fdf4', borderRadius: 8, padding: 10, marginTop: 12, borderWidth: 1, borderColor: '#bbf7d0'},
  selectedBadgeTxt: {fontSize: 13, color: '#16a34a', fontWeight: '600'},
  addBtn: {backgroundColor: '#7c3aed', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16},
  addBtnDisabled: {backgroundColor: '#c4b5fd'},
  btnInner: {flexDirection: 'row', alignItems: 'center', gap: 8},
  addBtnTxt: {color: '#ffffff', fontSize: 14, fontWeight: '700'},
  infoCard: {backgroundColor: '#fffbeb', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#fde68a', marginBottom: 16},
  infoTxt: {fontSize: 13, color: '#92400e', lineHeight: 20},
  importTitle: {fontSize: 16, fontWeight: '700', color: '#1e1b4b', marginBottom: 8},
  importDesc: {fontSize: 13, color: '#6b7280', lineHeight: 20, marginBottom: 14},
  excelFormat: {backgroundColor: '#f5f3ff', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#ede9fe'},
  excelFormatTitle: {fontSize: 12, fontWeight: '700', color: '#7c3aed', marginBottom: 6},
  excelCol: {fontSize: 12, color: '#6b7280', marginBottom: 4, lineHeight: 18},
  progressBox: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#bbf7d0'},
  progressTxt: {fontSize: 13, color: '#16a34a', fontWeight: '600', flex: 1},
  // MODAL
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modalBox: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 20,
    width: '100%', maxWidth: 360,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  modalTitle: {fontSize: 16, fontWeight: '700', color: '#1e1b4b'},
  modalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  modalLabel: {fontSize: 12, color: '#6b7280', fontWeight: '500'},
  modalValue: {fontSize: 12, color: '#1e1b4b', fontWeight: '600', flex: 1, textAlign: 'right'},
  modalHighlight: {color: '#7c3aed', fontSize: 14},
  modalCloseBtn: {
    backgroundColor: '#1e1b4b', borderRadius: 10,
    padding: 12, alignItems: 'center', marginTop: 16,
  },
  modalCloseTxt: {color: '#ffffff', fontSize: 14, fontWeight: '700'},
});