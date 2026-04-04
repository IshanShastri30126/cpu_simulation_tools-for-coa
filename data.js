// ─── CONCEPT DATA ────────────────────────────────────────────────────────────
// All theory, optimization, graph configs, and resource links for each CPU concept

const CONCEPTS = [
  {
    id: 'pipelining',
    name: 'Pipelining',
    icon: '🔁',
    color: '#00f5ff',
    subtitle: 'Overlap instruction stages for higher throughput',
    dailyUse: 'Work step-by-step like an assembly line',
    theory: `
      <h3>What is CPU Pipelining?</h3>
      <p>CPU pipelining divides instruction execution into discrete <strong>sequential stages</strong>, so multiple instructions can be processed simultaneously — just like an assembly line in a factory.</p>
      <div class="info-box">
        <div class="ib-title">⚡ Key Insight</div>
        <p>Instead of waiting for one instruction to fully complete before starting the next, the CPU overlaps execution across different instructions at different stages.</p>
      </div>
      <h3>The 5-Stage Pipeline (IF→ID→EX→MEM→WB)</h3>
      <ul>
        <li><strong>IF</strong> – Instruction Fetch: read from memory</li>
        <li><strong>ID</strong> – Instruction Decode: identify operation</li>
        <li><strong>EX</strong> – Execute: run the ALU operation</li>
        <li><strong>MEM</strong> – Memory Access: read/write data</li>
        <li><strong>WB</strong> – Write Back: store result to register</li>
      </ul>
      <h3>Pipeline Hazards</h3>
      <p>Pipelining introduces hazards that can cause <strong>stall bubbles</strong>:</p>
      <ul>
        <li><strong>Data Hazard</strong> – instruction needs result not yet computed</li>
        <li><strong>Control Hazard</strong> – branch changes instruction sequence</li>
        <li><strong>Structural Hazard</strong> – resource conflict between stages</li>
      </ul>
      <h3>Performance</h3>
      <p>Ideal speedup = number of pipeline stages. A 5-stage pipeline can theoretically deliver <code>5×</code> throughput vs a non-pipelined CPU. In practice, hazards reduce this to <code>~3-4×</code>.</p>
    `,
    optimization: `
      <h3>Solving Low Performance in Pipelining</h3>
      <p>Low performance in pipelining usually stems from <strong>frequent stalls</strong> caused by hazards. Here is how software developers and compilers handle the pipeline for better performance:</p>
      
      <h4>1. Instruction Scheduling</h4>
      <p>The compiler reorders instructions to separate dependent operations. If Instruction B needs the result of Instruction A, the compiler inserts independent Instructions C and D in between so that A's result is ready by the time B executes.</p>
      
      <h4>2. Loop Unrolling</h4>
      <p>Instead of branching back at the end of every loop iteration (which risks a control hazard flush), you "unroll" the loop to do more work per iteration. This minimizes branch instructions and maximizes pure data throughput.</p>
      
      <h4>3. Avoiding Complex Dependencies</h4>
      <p>Break down long, continuous dependency chains (e.g., <code>A = B + C; D = A * E; F = D / 2;</code>) into parallel tasks where possible. This ensures the CPU always has independent work to fetch into the pipeline.</p>
      
      <div class="info-box warn">
        <div class="ib-title">⚙️ Practical Tip</div>
        <p>If you profile your C/C++ code and see high "Pipeline Flush" or "Stall Cycles" metrics, check for unpredictable tight loops or long sequential math chains.</p>
      </div>
    `,
    graphInput: {
      label: 'Pipeline Stages',
      min: 1,
      max: 15,
      step: 1,
      default: 5
    },
    graph: {
      title: 'Real Throughput vs Stages',
      type: 'line',
      desc: 'Throughput increases with more stages, but hazard penalties (stalls/flushes) become more severe at high depth.',
      labels: [], // Populated dynamically
      datasets: [] // Populated dynamically 
    },
    resources: [
      { type: 'Textbook', icon: '📘', title: 'Computer Organization and Design (Patterson & Hennessy)', desc: 'The definitive textbook. Chapter 4 covers pipelining in depth with MIPS examples.', url: 'https://www.elsevier.com/books/computer-organization-and-design-risc-v-edition/patterson/978-0-12-820331-6' },
      { type: 'Blog', icon: '✍️', title: 'CPU Pipelining — Stanford CS Course Notes', desc: 'Clear academic explanation of pipeline stages, hazards, and forwarding.', url: 'https://cs.stanford.edu/people/eroberts/courses/soco/projects/risc/pipelining/index.html' },
      { type: 'Video', icon: '🎥', title: 'Pipelining – Computerphile (YouTube)', desc: 'Visual walkthrough of how real CPUs implement instruction pipelines.', url: 'https://www.youtube.com/watch?v=3TeHqBQnAqo' }
    ]
  },

  {
    id: 'superscalar',
    name: 'Superscalar',
    icon: '⚡',
    color: '#7c3aed',
    subtitle: 'Execute multiple instructions per clock cycle',
    dailyUse: 'Run light apps in parallel to use all CPU lanes',
    theory: `
      <h3>What is Superscalar Execution?</h3>
      <p>A <strong>superscalar processor</strong> can dispatch and execute more than one instruction per clock cycle by using multiple parallel execution units.</p>
      <div class="info-box">
        <div class="ib-title">⚡ Key Insight</div>
        <p>Modern CPUs have 4–8 execution units (ALUs, FPUs, Load/Store units) that can work simultaneously. IPC (Instructions Per Cycle) can exceed 4 on modern desktop chips.</p>
      </div>
      <h3>Execution Units</h3>
      <ul>
        <li><strong>ALU</strong> – Integer arithmetic and logic</li>
        <li><strong>FPU</strong> – Floating-point arithmetic</li>
        <li><strong>Load/Store Unit</strong> – Memory operations</li>
      </ul>
      <h3>Instruction-Level Parallelism (ILP)</h3>
      <p>The CPU detects independent instructions and issues them simultaneously. This is called <strong>ILP</strong>.</p>
    `,
    optimization: `
      <h3>Maximizing Superscalar Performance</h3>
      <p>To fully utilize a wide superscalar CPU, you must provide it with enough <strong>Instruction-Level Parallelism (ILP)</strong>.</p>
      
      <h4>1. Removing Data Dependencies</h4>
      <p>If every line of code relies directly on the previous line, the CPU cannot execute them in parallel. Write algorithms that work on independent chunks of data.</p>
      
      <h4>2. Utilizing Different Execution Ports</h4>
      <p>If you only do integer addition, you only use the integer ALUs, leaving the floating-point and memory units idle. A balanced workload (mix of math, memory access, and logic) achieves higher IPC.</p>
      
      <div class="info-box warn">
        <div class="ib-title">⚙️ Practical Tip</div>
        <p>Use Compiler Auto-Vectorization (e.g. <code>-O3 -march=native</code> in GCC). It automatically groups independent operations into batches that keep execution units busy.</p>
      </div>
    `,
    graphInput: {
      label: 'Execution Units',
      min: 1,
      max: 12,
      step: 1,
      default: 4
    },
    graph: {
      title: 'Achieved IPC vs Execution Units',
      type: 'line',
      desc: 'Adding more execution units increases IPC, but diminishing returns set in quickly if code lacks enough independent instructions (ILP).',
      labels: [],
      datasets: []
    },
    resources: [
      { type: 'Blog', icon: '✍️', title: 'Agner Fog — Microarchitecture Manual', desc: 'Extremely detailed breakdown of execution units in every major CPU microarchitecture. Industry standard reference.', url: 'https://www.agner.org/optimize/microarchitecture.pdf' }
    ]
  },

  {
    id: 'out-of-order',
    name: 'Out-of-Order',
    icon: '🔀',
    color: '#f59e0b',
    subtitle: 'Execute instructions when ready, not when scheduled',
    dailyUse: "Don't wait idle — do the next available task",
    theory: `
      <h3>What is Out-of-Order Execution?</h3>
      <p><strong>Out-of-Order Execution (OoOE)</strong> allows the CPU to execute instructions as soon as their inputs are ready, regardless of the original program order. This avoids pipeline stalls caused by slow operations (like memory loads).</p>
      <div class="info-box">
        <div class="ib-title">⚡ Key Insight</div>
        <p>Instructions can execute in any order, but results are always <em>committed</em> (written back) in the original program order to maintain correctness.</p>
      </div>
      <h3>Key Structures</h3>
      <ul>
        <li><strong>Reservation Station:</strong> holds instructions waiting for operands</li>
        <li><strong>Reorder Buffer (ROB):</strong> tracks in-flight instructions</li>
        <li><strong>Register Renaming:</strong> eliminates false dependencies</li>
      </ul>
    `,
    optimization: `
      <h3>Optimizing for Out-of-Order CPUs</h3>
      <p>While OoO execution hides latency automatically, hitting the limits of the Reorder Buffer (ROB) will cause the CPU to halt.</p>
      
      <h4>1. Hiding Memory Latency</h4>
      <p>If you know a variable will take a long time to load from memory, do it early. The OoO core will handle other independent work while waiting. However, if there's no independent work, the ROB fills up and the CPU stalls.</p>
      
      <h4>2. Pointer Disambiguation</h4>
      <p>If you pass two pointers to a function in C/C++, the compiler assumes they might point to the same memory (aliasing). This forces memory operations to run strictly in-order. Use the <code>restrict</code> keyword to tell the compiler they don't overlap, allowing the CPU to reorder loads and stores.</p>
    `,
    graphInput: {
      label: 'Memory Latency (Cycles)',
      min: 10,
      max: 300,
      step: 10,
      default: 100
    },
    graph: {
      title: 'Performance Drop with Memory Latency',
      type: 'line',
      desc: 'OoO Execution masks latency better than In-Order, but eventually the buffer fills up during massive DRAM delays.',
      labels: [],
      datasets: []
    },
    resources: [
      { type: 'Wikipedia', icon: '🌐', title: 'Out-of-order execution — Wikipedia', desc: 'Overview of Tomasulo algorithm, register renaming, and the reorder buffer (ROB).', url: 'https://en.wikipedia.org/wiki/Out-of-order_execution' }
    ]
  },

  {
    id: 'branch-prediction',
    name: 'Branch Prediction',
    icon: '🔮',
    color: '#10b981',
    subtitle: 'Guess the next instruction before the branch resolves',
    dailyUse: 'Pre-plan shortcuts based on past patterns',
    theory: `
      <h3>What is Branch Prediction?</h3>
      <p>Every time a CPU encounters an <strong>if/else or loop</strong>, it faces a branch. Branch prediction <em>guesses</em> which path to take speculatively.</p>
      <div class="info-box">
        <div class="ib-title">⚡ Key Insight</div>
        <p>Modern CPU branch predictors achieve <strong>>99% accuracy</strong>. A misprediction flushes the pipeline, wasting 15-20 clock cycles.</p>
      </div>
      <h3>Predictor Types</h3>
      <ul>
        <li><strong>1-bit:</strong> remember last outcome (~85%)</li>
        <li><strong>2-bit Saturating Counter:</strong> need 2 wrong predictions to change (~90%)</li>
        <li><strong>TAGE (Intel, AMD):</strong> >99% accuracy</li>
      </ul>
    `,
    optimization: `
      <h3>Solving Branch Misprediction Penalties</h3>
      
      <h4>1. Eliminate Unpredictable Branches</h4>
      <p>If you are sorting data based on a random condition inside a tight loop, the branch predictor will fail ~50% of the time, crippling performance. Always sort your data <strong>before</strong> processing it if the processing involves branching.</p>
      
      <h4>2. Branchless Programming</h4>
      <p>Replace <code>if (a > b) max = a; else max = b;</code> with conditional moves (CMOV) or bitwise math constraints. By completely removing the branch, the CPU pipeline flows uninterrupted.</p>
      
      <div class="info-box warn">
        <div class="ib-title">⚙️ Practical Tip</div>
        <p>The famous Stack Overflow question "Why is processing a sorted array faster than processing an unsorted array?" highlights exactly how branch prediction impacts real-world coding.</p>
      </div>
    `,
    graphInput: {
      label: 'Branch Predictability %',
      min: 10,
      max: 100,
      step: 5,
      default: 50
    },
    graph: {
      title: 'Pipeline Flushes vs Predictability',
      type: 'bar',
      desc: 'Highly predictable branches incur almost zero penalty. Random branches cause massive performance loss due to speculatively executing the wrong path.',
      labels: [],
      datasets: []
    },
    resources: [
      { type: 'Blog', icon: '✍️', title: 'Dan Luu — Branch Prediction', desc: 'Understanding branch prediction with code examples.', url: 'https://danluu.com/branch-prediction/' }
    ]
  },

  {
    id: 'cache',
    name: 'Cache Memory',
    icon: '💾',
    color: '#ef4444',
    subtitle: 'Keep frequently used data close to the CPU',
    dailyUse: 'Pin important apps & bookmarks for instant access',
    theory: `
      <h3>What is CPU Cache?</h3>
      <p>CPU cache is a small, extremely fast memory built directly onto the processor chip. It stores copies of frequently accessed data.</p>
      <div class="info-box">
        <div class="ib-title">⚡ Key Insight</div>
        <p>L1 access takes ~4 cycles. DRAM access takes ~200 cycles. A cache miss is <strong>50× more expensive</strong> than a hit.</p>
      </div>
      <h3>Hierarchy</h3>
      <ul>
        <li><strong>L1:</strong> ~4 cycles</li>
        <li><strong>L2:</strong> ~12 cycles</li>
        <li><strong>L3:</strong> ~40 cycles</li>
        <li><strong>DRAM:</strong> ~200 cycles</li>
      </ul>
    `,
    optimization: `
      <h3>Maximizing Cache Hit Rates</h3>
      
      <h4>1. Spatial Locality (Data Layout)</h4>
      <p>Data is loaded into the cache in 64-byte lines. If you read a variable, the neighbors are loaded for free. Prefer contiguous arrays over linked lists. Use <strong>Structure of Arrays (SoA)</strong> instead of Array of Structures (AoS) if you only process a subset of fields.</p>
      
      <h4>2. Temporal Locality</h4>
      <p>If you need to process data multiple times, do all the processing while it's still hot in L1 cache. Don't loop over a huge array 3 separate times.</p>
      
      <h4>3. Avoid False Sharing</h4>
      <p>If Core A and Core B are modifying two different variables that happen to sit right next to each other on the same 64-byte cache line, the caches will constantly invalidate each other, destroying performance. Align independent concurrent variables to 64 bytes (cache line padding).</p>
    `,
    graphInput: {
      label: 'Cache Hit Rate %',
      min: 0,
      max: 100,
      step: 1,
      default: 80
    },
    graph: {
      title: 'Average Memory Access Time',
      type: 'bar',
      desc: 'As your cache hit rate increases, the average access time approaches L1 speed. An 80% hit rate is decent, but 98%+ is where true performance lives.',
      labels: [],
      datasets: []
    },
    resources: [
      { type: 'Talk', icon: '🎤', title: 'CPU Caches and Why You Care (CppCon)', desc: 'Essential viewing for cache performance.', url: 'https://www.youtube.com/watch?v=WDIkqP4JbkE' }
    ]
  },

  {
    id: 'multicore',
    name: 'Multi-Core',
    icon: '🧠',
    color: '#3b82f6',
    subtitle: 'Multiple independent processors on one chip',
    dailyUse: 'Run parallel apps — each core handles different work',
    theory: `
      <h3>What is Multi-Core Processing?</h3>
      <p>A <strong>multi-core processor</strong> contains multiple independent CPU cores on a single chip. Each core can execute its own instruction stream.</p>
      <div class="info-box">
        <div class="ib-title">⚡ Key Insight</div>
        <p>Amdahl's law dictates that the theoretical speedup is strictly limited by the sequential fraction of a program.</p>
      </div>
    `,
    optimization: `
      <h3>Effectively Utilizing Multiple Cores</h3>
      
      <h4>1. Minimize Lock Contention</h4>
      <p>Spawning 16 threads that all wait for a single Mutex (lock) to update a shared counter makes your code slower than single-threaded code due to overhead. Use atomic operations or thread-local variables, joining them only at the end.</p>
      
      <h4>2. Use Thread Pools</h4>
      <p>Creating and destroying threads is expensive. Use a pre-warmed thread pool for parallel tasks so that cores don't waste time negotiating with the OS scheduler.</p>
      
      <h4>3. Maximize the Parallel Fraction</h4>
      <p>According to Amdahl's Law, if 10% of your code is strictly sequential, the maximum speedup you can ever achieve with infinite cores is 10x. Redesign your algorithms to allow concurrent data processing wherever possible.</p>
    `,
    graphInput: {
      label: 'Parallel Fraction %',
      min: 50,
      max: 100,
      step: 5,
      default: 90
    },
    graph: {
      title: "Amdahl's Law Speedup Limit",
      type: 'line',
      desc: "Adjust the parallel fraction to see how strictly the sequential code limits maximum scaling on high core counts.",
      labels: [],
      datasets: []
    },
    resources: [
      { type: 'Wikipedia', icon: '🌐', title: "Amdahl's Law — Wikipedia", desc: "Mathematical formulation of parallel speedup limits.", url: "https://en.wikipedia.org/wiki/Amdahl%27s_law" }
    ]
  },

  {
    id: 'simd',
    name: 'SIMD',
    icon: '📐',
    color: '#f97316',
    subtitle: 'One instruction operates on multiple data elements',
    dailyUse: 'Process an entire batch of data at once',
    theory: `
      <h3>What is SIMD?</h3>
      <p><strong>Single Instruction Multiple Data (SIMD)</strong> allows one CPU instruction to simultaneously perform the same operation on multiple data elements packed in a wide register.</p>
      <div class="info-box">
        <div class="ib-title">⚡ Key Insight</div>
        <p>Instead of adding 8 floats one at a time, SIMD adds all 8 in a single instruction. This gives up to <strong>16× speedup</strong>.</p>
      </div>
      <h3>ISA Extensions</h3>
      <ul>
        <li><strong>SSE:</strong> 128-bit</li>
        <li><strong>AVX:</strong> 256-bit</li>
        <li><strong>AVX-512:</strong> 512-bit</li>
      </ul>
    `,
    optimization: `
      <h3>Achieving Vectorization with SIMD</h3>
      
      <h4>1. Data Alignment</h4>
      <p>SIMD load/store instructions are much faster if the memory address is perfectly aligned to 16, 32, or 64 bytes boundaries. Unaligned loads enforce heavy penalties on older microarchitectures.</p>
      
      <h4>2. Loop Vectorization Rules</h4>
      <p>Compilers can only emit SIMD instructions automatically if your loop is predictable. Avoid using ` + "`break`" + ` or complex ` + "`if/else`" + ` statements inside loops. Keep loops strictly numerical and bounded.</p>
      
      <h4>3. Using Intrinsics</h4>
      <p>If the compiler fails to auto-vectorize, you can use intrinsic functions (e.g., <code>_mm256_add_ps</code> in C++) to manually instruct the CPU to use the 256-bit AVX vectors. This guarantees performance for engine math, graphics rendering, and machine learning processing.</p>
    `,
    graphInput: {
      label: 'Data Elements (Array Size)',
      min: 100,
      max: 1000,
      step: 100,
      default: 400
    },
    graph: {
      title: 'Time Taken: Scalar vs SIMD (AVX 256-bit)',
      type: 'bar',
      desc: 'SIMD processes 8 floats at once. The time taken scales significantly better than scalar as array sizes grow.',
      labels: [],
      datasets: []
    },
    resources: [
      { type: 'Reference', icon: '📘', title: "Intel Intrinsics Guide", desc: 'The definitive reference for x86 SIMD intrinsics.', url: 'https://www.intel.com/content/www/us/en/docs/intrinsics-guide/index.html' }
    ]
  }
];
