export default function Loading() {
    return (
        <main style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0a0a',
            color: '#888',
            fontFamily: 'var(--font-sans)',
        }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{
                    width: 32,
                    height: 32,
                    border: '3px solid #333',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite',
                    margin: '0 auto 16px',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
        </main>
    );
}
