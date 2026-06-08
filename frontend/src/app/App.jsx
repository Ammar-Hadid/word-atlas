import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "../components/layout/Layout.jsx";

import WordDetailsPage from "../pages/WordDetailsPage.jsx";
import SearchPage from "../pages/SearchPage.jsx";

const App = () => {

    return (
        <BrowserRouter>
            <Routes>
                <Route element={<Layout />}>
                    <Route path="/" element={<SearchPage />} />
                    <Route path="/:wordId" element={<WordDetailsPage />} />
                </Route>
            </Routes>
        </BrowserRouter>
    )
}

export default App