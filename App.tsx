import auth from '@react-native-firebase/auth';
import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import AdminScreen from './screens/AdminScreen';
import TeacherScreen from './screens/TeacherScreen';
import StudentScreen from './screens/StudentScreen';
import ParentScreen from './screens/ParentScreen';

const Stack = createNativeStackNavigator();

const ROLES = [
  {key: 'admin', label: 'Admin', icon: '⚙'},
  {key: 'teacher', label: 'Teacher', icon: '📚'},
  {key: 'student', label: 'Student', icon: '🎓'},
  {key: 'parent', label: 'Parent', icon: '👨‍👩‍👧'},
];

function LoginScreen({navigation}: any) {
  const [role, setRole] = useState('');
  const [id, setId] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!role) {
      setError('Please select a role first');
      return;
    }
    if (!id || !pass) {
      setError('Please enter ID and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const email = `${id}@quantaip.edu.pk`;
      await auth().signInWithEmailAndPassword(email, pass);

      if (role === 'admin') navigation.navigate('Admin');
      else if (role === 'teacher') navigation.navigate('Teacher');
      else if (role === 'student') navigation.navigate('Student');
      else if (role === 'parent') navigation.navigate('Parent');

    } catch (e: any) {
      setError('Invalid ID or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1e1b4b" />

      <View style={styles.navbar}>
        <Text style={styles.brand}>
          QUANT<Text style={styles.brandAccent}>AIP</Text>
        </Text>
        <Text style={styles.navSub}>EDUCATION OS</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        <View style={styles.header}>
          <Text style={styles.headerEye}>SECURE LOGIN</Text>
          <Text style={styles.headerTitle}>
            Welcome <Text style={styles.headerAccent}>Back</Text>
          </Text>
          <Text style={styles.headerSub}>Sign in to your account</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>SELECT YOUR ROLE</Text>
          <View style={styles.roleGrid}>
            {ROLES.map(r => (
              <TouchableOpacity
                key={r.key}
                style={[styles.roleBtn, role === r.key && styles.roleBtnOn]}
                onPress={() => setRole(r.key)}
                activeOpacity={0.7}>
                <Text style={styles.roleIcon}>{r.icon}</Text>
                <Text style={[styles.roleLabel, role === r.key && styles.roleLabelOn]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>STUDENT / STAFF ID</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. GHS-001-STU-0001"
            placeholderTextColor="#c4b5fd"
            value={id}
            onChangeText={setId}
            autoCapitalize="none"
          />

          <Text style={[styles.fieldLabel, {marginTop: 14}]}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#c4b5fd"
            value={pass}
            onChangeText={setPass}
            secureTextEntry
          />

          {error ? (
            <Text style={styles.errorTxt}>{error}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.loginBtn, (!role || loading) && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}>
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.loginBtnTxt}>
                {role ? `Login as ${ROLES.find(r => r.key === role)?.label}` : 'Select a role first'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.badges}>
          <View style={styles.badge}><Text style={styles.badgeTxt}>SECURE</Text></View>
          <View style={styles.badge}><Text style={styles.badgeTxt}>ENCRYPTED</Text></View>
          <View style={styles.badge}><Text style={styles.badgeTxt}>QUANTAIP</Text></View>
        </View>

        <Text style={styles.footer}>QUANTAIP © 2026 — QUANTUM AI PAKISTAN</Text>

      </ScrollView>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Admin" component={AdminScreen} />
        <Stack.Screen name="Teacher" component={TeacherScreen} />
        <Stack.Screen name="Student" component={StudentScreen} />
        <Stack.Screen name="Parent" component={ParentScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#faf5ff'},
  navbar: {
    backgroundColor: '#1e1b4b',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {fontSize: 20, fontWeight: '700', color: '#ffffff', letterSpacing: 2},
  brandAccent: {color: '#a78bfa'},
  navSub: {fontSize: 9, letterSpacing: 3, color: 'rgba(255,255,255,0.5)'},
  scroll: {padding: 16, paddingBottom: 40},
  header: {alignItems: 'center', marginVertical: 24},
  headerEye: {
    fontSize: 10,
    letterSpacing: 4,
    color: '#7c3aed',
    fontWeight: '600',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1e1b4b',
    marginBottom: 6,
  },
  headerAccent: {color: '#7c3aed'},
  headerSub: {fontSize: 14, color: '#6b7280'},
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ede9fe',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7c3aed',
    letterSpacing: 2,
    marginBottom: 10,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleBtn: {
    width: '47%',
    borderWidth: 1.5,
    borderColor: '#ede9fe',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#faf5ff',
    gap: 4,
  },
  roleBtnOn: {
    borderColor: '#7c3aed',
    backgroundColor: '#f5f3ff',
  },
  roleIcon: {fontSize: 20},
  roleLabel: {fontSize: 13, fontWeight: '500', color: '#6b7280'},
  roleLabelOn: {color: '#5b21b6', fontWeight: '700'},
  input: {
    backgroundColor: '#f5f3ff',
    borderWidth: 1.5,
    borderColor: '#ede9fe',
    borderRadius: 10,
    padding: 13,
    fontSize: 14,
    color: '#1e1b4b',
    fontWeight: '500',
  },
  errorTxt: {
    fontSize: 13,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
    fontWeight: '500',
  },
  loginBtn: {
    backgroundColor: '#1e1b4b',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 16,
  },
  loginBtnDisabled: {backgroundColor: '#c4b5fd'},
  loginBtnTxt: {color: '#ffffff', fontSize: 15, fontWeight: '700'},
  badges: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  badge: {
    borderWidth: 1,
    borderColor: '#ede9fe',
    backgroundColor: '#f5f3ff',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeTxt: {fontSize: 10, fontWeight: '600', color: '#7c3aed', letterSpacing: 1},
  footer: {textAlign: 'center', fontSize: 10, color: '#c4b5fd', letterSpacing: 1},
});