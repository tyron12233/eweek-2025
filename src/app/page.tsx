"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchStudentInfo } from '../lib/student';
import Image from 'next/image';
import { useRouter } from 'next/navigation';



const App = () => {
  const router = useRouter();

  useEffect(() => {
    router.replace('/leaderboard');
  }, [router]);

  return null;
};

export default App;
