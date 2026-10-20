package qa.pos;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/** Disposable JVM scheduling only. Never package with production classes. */
public final class PosTotalsBarrier {
    public static final class State {
        public final String transactionId;
        public final CountDownLatch reached = new CountDownLatch(1);
        public final CountDownLatch release = new CountDownLatch(1);
        private State(String id) { transactionId = id; }
    }
    private static final ConcurrentHashMap<String, State> STATES = new ConcurrentHashMap<>();
    private static final ThreadLocal<State> ACTIVE = new ThreadLocal<>();
    private static void guard() {
        if (!Boolean.getBoolean("pos.qa.disposable")) throw new SecurityException("Disposable runtime required");
    }
    public static void prepare(String sessionId, String transactionId) {
        guard(); STATES.put(sessionId, new State(transactionId));
    }
    public static State get(String sessionId, String transactionId) {
        guard(); State state = STATES.get(sessionId);
        return state != null && state.transactionId.equals(transactionId) ? state : null;
    }
    public static void activate(State state) { guard(); ACTIVE.set(state); }
    public static void clear() { ACTIVE.remove(); }
    public static boolean shouldPause(String transactionId) {
        return Boolean.getBoolean("pos.qa.disposable") && ACTIVE.get() != null && ACTIVE.get().transactionId.equals(transactionId);
    }
    public static void pause() throws InterruptedException {
        guard(); State state = ACTIVE.get(); state.reached.countDown();
        if (!state.release.await(15, TimeUnit.SECONDS)) throw new IllegalStateException("Disposable totals scheduling barrier timed out");
    }
}
