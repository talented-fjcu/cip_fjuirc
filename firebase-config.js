/**
 * Firebase Realtime Database Configuration & Initialization
 * 專案: cipfjuirc
 * 區域: asia-southeast1 (新加坡)
 */
const firebaseConfig = {
  apiKey: "AIzaSyCnmG0K2V7L13JAya7oIORmEQowTGzphtU",
  authDomain: "cipfjuirc.firebaseapp.com",
  databaseURL: "https://cipfjuirc-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "cipfjuirc",
  storageBucket: "cipfjuirc.firebasestorage.app",
  messagingSenderId: "479907067171",
  appId: "1:479907067171:web:7d5e9d31a7747db4844896"
};

// 初始化 Firebase (相容模式 CDN)
if (typeof firebase !== "undefined") {
  if (!firebase.apps || !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
}
