// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCeoJ9j9l555zYRWYC_LMRYznYHxSUcxKQ",
    authDomain: "solamar-care.firebaseapp.com",
    projectId: "solamar-care",
    storageBucket: "solamar-care.firebasestorage.app",
    messagingSenderId: "438730622308",
    appId: "1:438730622308:web:cee02c038ac238806e2671"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// Initialize Auth
const auth = firebase.auth(); 