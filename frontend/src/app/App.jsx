import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { MotionConfig } from "motion/react";

import Layout from "../components/layout/Layout.jsx";
import ThemeProvider from "../context/ThemeProvider.jsx";
import LibraryProvider from "../context/LibraryProvider.jsx";
import ToastProvider from "../context/ToastProvider.jsx";
import CommandProvider from "../context/CommandProvider.jsx";

import HomePage from "../pages/HomePage.jsx";
import WordPage from "../pages/WordPage.jsx";
import LibraryPage from "../pages/LibraryPage.jsx";
import NotFoundPage from "../pages/NotFoundPage.jsx";

import { wordPath } from "../lib/platform.js";

// Older links used /:word; keep them working.
const LegacyWordRedirect = () => {
    const { wordId } = useParams();
    return <Navigate to={wordPath(wordId)} replace />;
};

const App = () => {
    return (
        <MotionConfig reducedMotion="user">
            <ThemeProvider>
                <LibraryProvider>
                    <ToastProvider>
                        <BrowserRouter>
                            <CommandProvider>
                                <Routes>
                                    <Route element={<Layout />}>
                                        <Route path="/" element={<HomePage />} />
                                        <Route path="/word/:term" element={<WordPage />} />
                                        <Route path="/library" element={<LibraryPage />} />
                                        <Route path="/:wordId" element={<LegacyWordRedirect />} />
                                        <Route path="*" element={<NotFoundPage />} />
                                    </Route>
                                </Routes>
                            </CommandProvider>
                        </BrowserRouter>
                    </ToastProvider>
                </LibraryProvider>
            </ThemeProvider>
        </MotionConfig>
    )
}

export default App
