module.exports = [
"[project]/app/review-client.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ReviewClient",
    ()=>ReviewClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$review$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/review.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
function ReviewClient({ authenticated, initialAnswers, total }) {
    const [isAuthenticated, setIsAuthenticated] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(authenticated);
    const [answers, setAnswers] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(initialAnswers);
    const [screen, setScreen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(authenticated && initialAnswers.length === total ? 'complete' : 'home');
    const [questionId, setQuestionId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])();
    const [reviewingAnswers, setReviewingAnswers] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [saving, setSaving] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [message, setMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])();
    const summary = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$review$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["reviewSummary"])(answers), [
        answers
    ]);
    const question = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$review$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["questions"].find(({ id })=>id === questionId) ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$review$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["nextUnansweredQuestion"])(answers);
    const questionIndex = question ? __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$review$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["questions"].findIndex(({ id })=>id === question.id) : -1;
    function begin(reviewAnswers = false) {
        const next = reviewAnswers ? __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$review$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["questions"][0] : (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$review$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["nextUnansweredQuestion"])(answers);
        if (!next) {
            setScreen('complete');
            return;
        }
        setReviewingAnswers(reviewAnswers);
        setQuestionId(next.id);
        setMessage(undefined);
        setScreen('review');
    }
    async function signIn(event) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const accessSecret = form.get('accessSecret');
        setSaving(true);
        setMessage(undefined);
        const response = await fetch('/api/session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                accessSecret
            })
        });
        setSaving(false);
        if (!response.ok) {
            setMessage('Access could not be verified. Please try again.');
            return;
        }
        setIsAuthenticated(true);
    }
    async function answer(value) {
        if (!question || saving) return;
        setSaving(true);
        setMessage('Saving…');
        const response = await fetch('/api/answers', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                questionId: question.id,
                answer: value
            })
        });
        const payload = await response.json().catch(()=>undefined);
        setSaving(false);
        if (!response.ok || !payload?.answer) {
            setMessage('Could not save. Please try again.');
            return;
        }
        const saved = payload.answer;
        const updated = [
            ...answers.filter(({ questionId: id })=>id !== saved.questionId),
            saved
        ];
        setAnswers(updated);
        const next = reviewingAnswers ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$review$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["nextReviewQuestion"])(question.id) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$review$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["nextUnansweredQuestion"])(updated, question.id);
        if (next) {
            setQuestionId(next.id);
            setMessage(undefined);
        } else {
            setScreen('complete');
            setMessage(undefined);
        }
    }
    if (!isAuthenticated) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
            className: "shell login",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "brand",
                    children: "Muffle"
                }, void 0, false, {
                    fileName: "[project]/app/review-client.tsx",
                    lineNumber: 103,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                    children: "Ontology Review"
                }, void 0, false, {
                    fileName: "[project]/app/review-client.tsx",
                    lineNumber: 104,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                    onSubmit: signIn,
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                            htmlFor: "access-secret",
                            children: "Access code"
                        }, void 0, false, {
                            fileName: "[project]/app/review-client.tsx",
                            lineNumber: 106,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                            id: "access-secret",
                            name: "accessSecret",
                            type: "password",
                            autoComplete: "current-password",
                            required: true
                        }, void 0, false, {
                            fileName: "[project]/app/review-client.tsx",
                            lineNumber: 107,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            className: "primary",
                            disabled: saving,
                            children: saving ? 'CHECKING…' : 'CONTINUE'
                        }, void 0, false, {
                            fileName: "[project]/app/review-client.tsx",
                            lineNumber: 108,
                            columnNumber: 11
                        }, this),
                        message && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "status",
                            role: "alert",
                            children: message
                        }, void 0, false, {
                            fileName: "[project]/app/review-client.tsx",
                            lineNumber: 109,
                            columnNumber: 23
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/review-client.tsx",
                    lineNumber: 105,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/review-client.tsx",
            lineNumber: 102,
            columnNumber: 7
        }, this);
    }
    if (screen === 'complete') {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
            className: "shell home",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "brand",
                    children: "Muffle"
                }, void 0, false, {
                    fileName: "[project]/app/review-client.tsx",
                    lineNumber: 118,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                    children: "Review complete"
                }, void 0, false, {
                    fileName: "[project]/app/review-client.tsx",
                    lineNumber: 119,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "count",
                    children: [
                        summary.completed,
                        " of ",
                        summary.total,
                        " completed"
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/review-client.tsx",
                    lineNumber: 120,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("dl", {
                    className: "totals",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                    children: "Yes"
                                }, void 0, false, {
                                    fileName: "[project]/app/review-client.tsx",
                                    lineNumber: 122,
                                    columnNumber: 16
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                    children: summary.yes
                                }, void 0, false, {
                                    fileName: "[project]/app/review-client.tsx",
                                    lineNumber: 122,
                                    columnNumber: 28
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/review-client.tsx",
                            lineNumber: 122,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                    children: "No"
                                }, void 0, false, {
                                    fileName: "[project]/app/review-client.tsx",
                                    lineNumber: 123,
                                    columnNumber: 16
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                    children: summary.no
                                }, void 0, false, {
                                    fileName: "[project]/app/review-client.tsx",
                                    lineNumber: 123,
                                    columnNumber: 27
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/review-client.tsx",
                            lineNumber: 123,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                    children: "Not sure"
                                }, void 0, false, {
                                    fileName: "[project]/app/review-client.tsx",
                                    lineNumber: 124,
                                    columnNumber: 16
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                    children: summary.notSure
                                }, void 0, false, {
                                    fileName: "[project]/app/review-client.tsx",
                                    lineNumber: 124,
                                    columnNumber: 33
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/review-client.tsx",
                            lineNumber: 124,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/review-client.tsx",
                    lineNumber: 121,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "thanks",
                    children: "Thank you."
                }, void 0, false, {
                    fileName: "[project]/app/review-client.tsx",
                    lineNumber: 126,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    className: "primary",
                    onClick: ()=>begin(true),
                    children: "REVIEW ANSWERS"
                }, void 0, false, {
                    fileName: "[project]/app/review-client.tsx",
                    lineNumber: 127,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/review-client.tsx",
            lineNumber: 117,
            columnNumber: 7
        }, this);
    }
    if (screen === 'home') {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
            className: "shell home",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "brand",
                    children: "Muffle"
                }, void 0, false, {
                    fileName: "[project]/app/review-client.tsx",
                    lineNumber: 135,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                    children: "Ontology Review"
                }, void 0, false, {
                    fileName: "[project]/app/review-client.tsx",
                    lineNumber: 136,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "count",
                    children: [
                        summary.total,
                        " questions",
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("br", {}, void 0, false, {
                            fileName: "[project]/app/review-client.tsx",
                            lineNumber: 137,
                            columnNumber: 55
                        }, this),
                        summary.completed,
                        " completed"
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/review-client.tsx",
                    lineNumber: 137,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    className: "primary",
                    onClick: ()=>begin(),
                    children: summary.completed > 0 ? 'CONTINUE' : 'START'
                }, void 0, false, {
                    fileName: "[project]/app/review-client.tsx",
                    lineNumber: 138,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/review-client.tsx",
            lineNumber: 134,
            columnNumber: 7
        }, this);
    }
    if (!question) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "shell review",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "progress",
                "aria-live": "polite",
                children: [
                    questionIndex + 1,
                    " of ",
                    total
                ]
            }, void 0, true, {
                fileName: "[project]/app/review-client.tsx",
                lineNumber: 148,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                className: "question",
                children: question.question
            }, void 0, false, {
                fileName: "[project]/app/review-client.tsx",
                lineNumber: 149,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "answer-actions",
                "aria-label": "Answer options",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: "answer",
                        disabled: saving,
                        onClick: ()=>answer('yes'),
                        children: "YES"
                    }, void 0, false, {
                        fileName: "[project]/app/review-client.tsx",
                        lineNumber: 151,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: "answer",
                        disabled: saving,
                        onClick: ()=>answer('no'),
                        children: "NO"
                    }, void 0, false, {
                        fileName: "[project]/app/review-client.tsx",
                        lineNumber: 152,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: "answer",
                        disabled: saving,
                        onClick: ()=>answer('not-sure'),
                        children: "NOT SURE"
                    }, void 0, false, {
                        fileName: "[project]/app/review-client.tsx",
                        lineNumber: 153,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/review-client.tsx",
                lineNumber: 150,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "review-footer",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: "back",
                        disabled: saving || questionIndex === 0,
                        onClick: ()=>setQuestionId(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$review$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["questions"][questionIndex - 1]?.id),
                        children: "Back"
                    }, void 0, false, {
                        fileName: "[project]/app/review-client.tsx",
                        lineNumber: 156,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "status",
                        "aria-live": "polite",
                        children: message
                    }, void 0, false, {
                        fileName: "[project]/app/review-client.tsx",
                        lineNumber: 163,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/review-client.tsx",
                lineNumber: 155,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/review-client.tsx",
        lineNumber: 147,
        columnNumber: 5
    }, this);
}
}),
"[project]/data/ontology-review-v1.json.[json].cjs [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {

module.exports = JSON.parse("{\"version\":\"ontology-review-v1\",\"questions\":[{\"id\":\"question.candidate.alias.main-walls.alias\",\"candidateId\":\"candidate.alias.main-walls\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Does “Main Walls” mean the same thing as “External wall”?\",\"context\":{\"sourceTerm\":\"Main Walls\",\"proposedTerm\":\"External wall\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.balcony.canonical-independence\",\"candidateId\":\"candidate.building_element.balcony\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Would “Balcony” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Balcony\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.boundary.canonical-independence\",\"candidateId\":\"candidate.building_element.boundary\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Would “Boundary” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Boundary\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.ceiling.canonical-independence\",\"candidateId\":\"candidate.building_element.ceiling\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Would “Ceiling” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Ceiling\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.cellar_basement.canonical-independence\",\"candidateId\":\"candidate.building_element.cellar_basement\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Would “Cellar or basement” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Cellar or basement\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.chimney.canonical-independence\",\"candidateId\":\"candidate.building_element.chimney\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Would “Chimney” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Chimney\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.conservatory.canonical-independence\",\"candidateId\":\"candidate.building_element.conservatory\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Would “Conservatory” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Conservatory\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.damp_proof_course.canonical-independence\",\"candidateId\":\"candidate.building_element.damp_proof_course\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Would “Damp proof course” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Damp proof course\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.drainage.same-as.candidate.building_element.external_drainage\",\"candidateId\":\"candidate.building_element.drainage\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\",\"POTENTIAL_SEMANTIC_DUPLICATE\"],\"question\":\"Does “Drainage” mean the same thing as “External drainage” in a surveying inspection?\",\"context\":{\"sourceTerm\":\"Drainage\",\"proposedTerm\":\"External drainage\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.driveway.canonical-independence\",\"candidateId\":\"candidate.building_element.driveway\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Would “Driveway” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Driveway\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.electrical_installation.same-as.candidate.building_element.gas_installation\",\"candidateId\":\"candidate.building_element.electrical_installation\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\",\"POTENTIAL_SEMANTIC_DUPLICATE\"],\"question\":\"Does “Electrical installation” mean the same thing as “Gas installation” in a surveying inspection?\",\"context\":{\"sourceTerm\":\"Electrical installation\",\"proposedTerm\":\"Gas installation\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.external_door.same-as.candidate.building_element.external_drainage\",\"candidateId\":\"candidate.building_element.external_door\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\",\"OVERLAPS_EXISTING_CANONICAL_CONCEPT\",\"POTENTIAL_SEMANTIC_DUPLICATE\",\"POTENTIAL_SEMANTIC_DUPLICATE\",\"POTENTIAL_SEMANTIC_DUPLICATE\"],\"question\":\"Does “External door” mean the same thing as “External drainage” in a surveying inspection?\",\"context\":{\"sourceTerm\":\"External door\",\"proposedTerm\":\"External drainage\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.external_drainage.same-as.candidate.building_element.external_drainage\",\"candidateId\":\"candidate.building_element.external_drainage\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\",\"OVERLAPS_EXISTING_CANONICAL_CONCEPT\",\"POTENTIAL_SEMANTIC_DUPLICATE\",\"POTENTIAL_SEMANTIC_DUPLICATE\",\"POTENTIAL_SEMANTIC_DUPLICATE\"],\"question\":\"Does “External drainage” mean the same thing as “External drainage” in a surveying inspection?\",\"context\":{\"sourceTerm\":\"External drainage\",\"proposedTerm\":\"External drainage\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.external_finish.same-as.candidate.building_element.external_finish\",\"candidateId\":\"candidate.building_element.external_finish\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\",\"OVERLAPS_EXISTING_CANONICAL_CONCEPT\",\"POTENTIAL_SEMANTIC_DUPLICATE\",\"POTENTIAL_SEMANTIC_DUPLICATE\"],\"question\":\"Does “External finish” mean the same thing as “External finish” in a surveying inspection?\",\"context\":{\"sourceTerm\":\"External finish\",\"proposedTerm\":\"External finish\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.fireplace.canonical-independence\",\"candidateId\":\"candidate.building_element.fireplace\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Would “Fireplace” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Fireplace\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.floor.canonical-independence\",\"candidateId\":\"candidate.building_element.floor\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Would “Floor” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Floor\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.foundation.canonical-independence\",\"candidateId\":\"candidate.building_element.foundation\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\",\"LOW_CONFIDENCE_NEW_CANONICAL\"],\"question\":\"Would “Foundation” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Foundation\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.garage.canonical-independence\",\"candidateId\":\"candidate.building_element.garage\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Would “Garage” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Garage\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.gas_installation.same-as.candidate.building_element.gas_installation\",\"candidateId\":\"candidate.building_element.gas_installation\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\",\"POTENTIAL_SEMANTIC_DUPLICATE\"],\"question\":\"Does “Gas installation” mean the same thing as “Gas installation” in a surveying inspection?\",\"context\":{\"sourceTerm\":\"Gas installation\",\"proposedTerm\":\"Gas installation\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.heating_system.same-as.candidate.building_element.hot_water_system\",\"candidateId\":\"candidate.building_element.heating_system\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\",\"POTENTIAL_SEMANTIC_DUPLICATE\",\"POTENTIAL_SEMANTIC_DUPLICATE\"],\"question\":\"Does “Heating system” mean the same thing as “Hot water system” in a surveying inspection?\",\"context\":{\"sourceTerm\":\"Heating system\",\"proposedTerm\":\"Hot water system\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.hot_water_system.same-as.candidate.building_element.hot_water_system\",\"candidateId\":\"candidate.building_element.hot_water_system\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\",\"POTENTIAL_SEMANTIC_DUPLICATE\",\"POTENTIAL_SEMANTIC_DUPLICATE\"],\"question\":\"Does “Hot water system” mean the same thing as “Hot water system” in a surveying inspection?\",\"context\":{\"sourceTerm\":\"Hot water system\",\"proposedTerm\":\"Hot water system\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.internal_door.same-as.candidate.building_element.internal_door\",\"candidateId\":\"candidate.building_element.internal_door\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\",\"OVERLAPS_EXISTING_CANONICAL_CONCEPT\",\"POTENTIAL_SEMANTIC_DUPLICATE\",\"POTENTIAL_SEMANTIC_DUPLICATE\"],\"question\":\"Does “Internal door” mean the same thing as “Internal door” in a surveying inspection?\",\"context\":{\"sourceTerm\":\"Internal door\",\"proposedTerm\":\"Internal door\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.internal_wall.same-as.candidate.building_element.internal_door\",\"candidateId\":\"candidate.building_element.internal_wall\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\",\"OVERLAPS_EXISTING_CANONICAL_CONCEPT\",\"POTENTIAL_SEMANTIC_DUPLICATE\",\"POTENTIAL_SEMANTIC_DUPLICATE\"],\"question\":\"Does “Internal wall” mean the same thing as “Internal door” in a surveying inspection?\",\"context\":{\"sourceTerm\":\"Internal wall\",\"proposedTerm\":\"Internal door\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.outbuilding.canonical-independence\",\"candidateId\":\"candidate.building_element.outbuilding\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Would “Outbuilding” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Outbuilding\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.partition.canonical-independence\",\"candidateId\":\"candidate.building_element.partition\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Would “Partition” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Partition\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.path.canonical-independence\",\"candidateId\":\"candidate.building_element.path\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Would “Path” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Path\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.patio.canonical-independence\",\"candidateId\":\"candidate.building_element.patio\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Would “Patio” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Patio\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.porch.canonical-independence\",\"candidateId\":\"candidate.building_element.porch\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Would “Porch” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Porch\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.rainwater_goods.canonical-independence\",\"candidateId\":\"candidate.building_element.rainwater_goods\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Would “Rainwater goods” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Rainwater goods\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.renewable_energy_system.same-as.candidate.building_element.renewable_energy_system\",\"candidateId\":\"candidate.building_element.renewable_energy_system\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\",\"LOW_CONFIDENCE_NEW_CANONICAL\",\"POTENTIAL_SEMANTIC_DUPLICATE\"],\"question\":\"Does “Renewable energy system” mean the same thing as “Renewable energy system” in a surveying inspection?\",\"context\":{\"sourceTerm\":\"Renewable energy system\",\"proposedTerm\":\"Renewable energy system\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.retaining_wall.same-as.candidate.building_element.retaining_wall\",\"candidateId\":\"candidate.building_element.retaining_wall\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\",\"OVERLAPS_EXISTING_CANONICAL_CONCEPT\",\"POTENTIAL_SEMANTIC_DUPLICATE\"],\"question\":\"Does “Retaining wall” mean the same thing as “Retaining wall” in a surveying inspection?\",\"context\":{\"sourceTerm\":\"Retaining wall\",\"proposedTerm\":\"Retaining wall\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.roof_covering.same-as.candidate.building_element.roof_structure\",\"candidateId\":\"candidate.building_element.roof_covering\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\",\"POTENTIAL_SEMANTIC_DUPLICATE\",\"POTENTIAL_SEMANTIC_DUPLICATE\"],\"question\":\"Does “Roof covering” mean the same thing as “Roof structure” in a surveying inspection?\",\"context\":{\"sourceTerm\":\"Roof covering\",\"proposedTerm\":\"Roof structure\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.roof_structure.same-as.candidate.building_element.roof_structure\",\"candidateId\":\"candidate.building_element.roof_structure\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\",\"POTENTIAL_SEMANTIC_DUPLICATE\",\"POTENTIAL_SEMANTIC_DUPLICATE\"],\"question\":\"Does “Roof structure” mean the same thing as “Roof structure” in a surveying inspection?\",\"context\":{\"sourceTerm\":\"Roof structure\",\"proposedTerm\":\"Roof structure\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.roof_void.same-as.candidate.building_element.roof_void\",\"candidateId\":\"candidate.building_element.roof_void\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\",\"POTENTIAL_SEMANTIC_DUPLICATE\",\"POTENTIAL_SEMANTIC_DUPLICATE\"],\"question\":\"Does “Roof void” mean the same thing as “Roof void” in a surveying inspection?\",\"context\":{\"sourceTerm\":\"Roof void\",\"proposedTerm\":\"Roof void\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.staircase.canonical-independence\",\"candidateId\":\"candidate.building_element.staircase\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Would “Staircase” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Staircase\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.tree_vegetation.canonical-independence\",\"candidateId\":\"candidate.building_element.tree_vegetation\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\",\"LOW_CONFIDENCE_NEW_CANONICAL\"],\"question\":\"Would “Tree or vegetation” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Tree or vegetation\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.ventilation.canonical-independence\",\"candidateId\":\"candidate.building_element.ventilation\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Would “Ventilation” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Ventilation\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.water_supply.same-as.candidate.building_element.hot_water_system\",\"candidateId\":\"candidate.building_element.water_supply\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\",\"POTENTIAL_SEMANTIC_DUPLICATE\"],\"question\":\"Does “Water supply” mean the same thing as “Hot water system” in a surveying inspection?\",\"context\":{\"sourceTerm\":\"Water supply\",\"proposedTerm\":\"Hot water system\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.building_element.window.canonical-independence\",\"candidateId\":\"candidate.building_element.window\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Would “Window” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Window\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.cause.canonical-independence\",\"candidateId\":\"candidate.cause\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\",\"LOW_CONFIDENCE_NEW_CANONICAL\"],\"question\":\"Would “Cause” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Cause\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.further_investigation.canonical-independence\",\"candidateId\":\"candidate.further_investigation\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Would “Further investigation” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Further investigation\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.implication.canonical-independence\",\"candidateId\":\"candidate.implication\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\",\"LOW_CONFIDENCE_NEW_CANONICAL\"],\"question\":\"Would “Implication” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Implication\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.limitation.same-as-existing\",\"candidateId\":\"candidate.limitation\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\",\"LOW_CONFIDENCE_NEW_CANONICAL\",\"OVERLAPS_EXISTING_CANONICAL_CONCEPT\"],\"question\":\"Does “Finding limitation” mean the same thing as “Limitations” in a surveying inspection?\",\"context\":{\"sourceTerm\":\"Finding limitation\",\"proposedTerm\":\"Limitations\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.measurement.canonical-independence\",\"candidateId\":\"candidate.measurement\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Would “Measurement” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Measurement\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.publication.rics-d4-main-walls.publication-wording\",\"candidateId\":\"candidate.publication.rics-d4-main-walls\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Does “D4 Main Walls” describe an underlying surveying concept rather than only a report heading?\",\"context\":{\"sourceTerm\":\"D4 Main Walls\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.publication.rics-section-heading.publication-wording\",\"candidateId\":\"candidate.publication.rics-section-heading\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Does “RICS section heading” describe an underlying surveying concept rather than only a report heading?\",\"context\":{\"sourceTerm\":\"RICS section heading\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.risk.canonical-independence\",\"candidateId\":\"candidate.risk\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\",\"LOW_CONFIDENCE_NEW_CANONICAL\"],\"question\":\"Would “Risk” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Risk\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate.significance.canonical-independence\",\"candidateId\":\"candidate.significance\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\",\"LOW_CONFIDENCE_NEW_CANONICAL\"],\"question\":\"Would “Significance” still be a meaningful surveying concept if report headings changed?\",\"context\":{\"sourceTerm\":\"Significance\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate-relation.cause-explains-defect.relationship\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Should “Cause” be understood as “explains” “Defect” in a surveying finding?\",\"context\":{\"sourceTerm\":\"Cause\",\"proposedTerm\":\"Defect\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate-relation.defect-supported-by-observation.relationship\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Should “Defect” be understood as “is supported by” “Observation” in a surveying finding?\",\"context\":{\"sourceTerm\":\"Defect\",\"proposedTerm\":\"Observation\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate-relation.evidence-supports-observation.relationship\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Should “Evidence” be understood as “supports” “Observation” in a surveying finding?\",\"context\":{\"sourceTerm\":\"Evidence\",\"proposedTerm\":\"Observation\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate-relation.implication-results-from-defect.relationship\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Should “Implication” be understood as “results from” “Defect” in a surveying finding?\",\"context\":{\"sourceTerm\":\"Implication\",\"proposedTerm\":\"Defect\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate-relation.investigation-investigates-limitation.relationship\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Should “Further investigation” be understood as “investigates” “Finding limitation” in a surveying finding?\",\"context\":{\"sourceTerm\":\"Further investigation\",\"proposedTerm\":\"Finding limitation\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate-relation.recommendation-addresses-defect.relationship\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Should “Recommendation” be understood as “addresses” “Defect” in a surveying finding?\",\"context\":{\"sourceTerm\":\"Recommendation\",\"proposedTerm\":\"Defect\"},\"answerType\":\"yes-no-not-sure\"},{\"id\":\"question.candidate-relation.risk-arises-from-implication.relationship\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"question\":\"Should “Risk” be understood as “arises from” “Implication” in a surveying finding?\",\"context\":{\"sourceTerm\":\"Risk\",\"proposedTerm\":\"Implication\"},\"answerType\":\"yes-no-not-sure\"}],\"manualQuestionReview\":[{\"candidateId\":\"candidate.building_element.construction_type\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"reason\":\"Existing structured metadata does not support one focused yes/no/not-sure question.\"},{\"candidateId\":\"candidate.building_element.location\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"reason\":\"Existing structured metadata does not support one focused yes/no/not-sure question.\"},{\"candidateId\":\"candidate.building_element.material\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"reason\":\"Existing structured metadata does not support one focused yes/no/not-sure question.\"},{\"candidateId\":\"candidate.uncertain.construction\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"reason\":\"Existing structured metadata does not support one focused yes/no/not-sure question.\"},{\"candidateId\":\"candidate.uncertain.external-elevations\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"reason\":\"Existing structured metadata does not support one focused yes/no/not-sure question.\"},{\"candidateId\":\"candidate.value.condition-rating\",\"auditIssueCodes\":[\"EXPERT_REVIEW_REQUIRED\"],\"reason\":\"Existing structured metadata does not support one focused yes/no/not-sure question.\"}]}");
}),
"[project]/lib/review.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ANSWERS",
    ()=>ANSWERS,
    "QUESTION_SET_VERSION",
    ()=>QUESTION_SET_VERSION,
    "isReviewAnswer",
    ()=>isReviewAnswer,
    "isValidQuestionId",
    ()=>isValidQuestionId,
    "nextReviewQuestion",
    ()=>nextReviewQuestion,
    "nextUnansweredQuestion",
    ()=>nextUnansweredQuestion,
    "questionIds",
    ()=>questionIds,
    "questions",
    ()=>questions,
    "reviewSummary",
    ()=>reviewSummary
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$data$2f$ontology$2d$review$2d$v1$2e$json$2e5b$json$5d2e$cjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/data/ontology-review-v1.json.[json].cjs [app-ssr] (ecmascript)");
;
const QUESTION_SET_VERSION = __TURBOPACK__imported__module__$5b$project$5d2f$data$2f$ontology$2d$review$2d$v1$2e$json$2e5b$json$5d2e$cjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"].version;
const ANSWERS = [
    'yes',
    'no',
    'not-sure'
];
const questions = __TURBOPACK__imported__module__$5b$project$5d2f$data$2f$ontology$2d$review$2d$v1$2e$json$2e5b$json$5d2e$cjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"].questions;
const questionIds = new Set(questions.map(({ id })=>id));
function isReviewAnswer(value) {
    return typeof value === 'string' && ANSWERS.includes(value);
}
function isValidQuestionId(value) {
    return typeof value === 'string' && questionIds.has(value);
}
function nextUnansweredQuestion(savedAnswers, afterQuestionId) {
    const answered = new Set(savedAnswers.map(({ questionId })=>questionId));
    const unanswered = questions.filter(({ id })=>!answered.has(id));
    if (!afterQuestionId) return unanswered[0];
    const start = questions.findIndex(({ id })=>id === afterQuestionId);
    return questions.slice(start + 1).find(({ id })=>!answered.has(id)) ?? questions.slice(0, Math.max(start, 0)).find(({ id })=>!answered.has(id));
}
function nextReviewQuestion(questionId) {
    const index = questions.findIndex(({ id })=>id === questionId);
    return index >= 0 ? questions[index + 1] : undefined;
}
function reviewSummary(savedAnswers) {
    const values = new Map(savedAnswers.map((answer)=>[
            answer.questionId,
            answer.answer
        ]));
    return {
        total: questions.length,
        completed: values.size,
        unanswered: questions.length - values.size,
        yes: [
            ...values.values()
        ].filter((answer)=>answer === 'yes').length,
        no: [
            ...values.values()
        ].filter((answer)=>answer === 'no').length,
        notSure: [
            ...values.values()
        ].filter((answer)=>answer === 'not-sure').length
    };
}
}),
"[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

module.exports = __turbopack_context__.r("[project]/node_modules/next/dist/server/route-modules/app-page/module.compiled.js [app-ssr] (ecmascript)").vendored['react-ssr'].ReactJsxDevRuntime;
}),
];

//# sourceMappingURL=_1twgkq0._.js.map