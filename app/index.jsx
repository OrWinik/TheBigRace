import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth, onAuthStateChanged } from 'firebase/auth';
import { getDatabase } from "firebase/database";
import { useEffect } from 'react';

const firebaseConfig = {
    apiKey: "AIzaSyCCh7p8AxPswwqYeOVyoFYxwvFmqUgjHgM",
    authDomain: "triptailor-71050.firebaseapp.com",
    projectId: "triptailor-71050",
    storageBucket: "triptailor-71050.firebasestorage.app",
    messagingSenderId: "138789959645",
    appId: "1:138789959645:ios:08d97a30a6bc059eb5e834",
    databaseURL: "https://triptailor-71050-default-rtdb.firebaseio.com", 
};

const app = initializeApp(firebaseConfig); 

console.log("firebase is init : " , app);

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

export default function IndexPage() {
    const router = useRouter();
  
    useEffect(() => {
          
      const database = getDatabase(app); 
  
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user == true) 
        {
          checkFirstTimeLogin(user); 
        } 
        else 
        {
          router.replace('/auth/');
        }
      });  
      return () => unsubscribe();
  
    }, [router]);
  
    return null;
  }