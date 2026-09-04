const ruleList = [
  { title: '隐私与个人信息', detail: '不发布他人的姓名、联系方式、住址、精确位置、账号凭证等隐私信息；同样请勿暴露自己的真实身份信息。' },
  { title: '违法与危险内容', detail: '不发布明确违法内容、交易或操作指引；不发布恶意软件、钓鱼链接与凭证窃取内容。' },
  { title: '骚扰与攻击', detail: '不对个人或群体进行威胁、持续骚扰、仇恨攻击或“开盒”式曝光。' },
  { title: '色情与未成年保护', detail: '不发布未经同意的私密影像、性剥削内容和涉及未成年人的不当内容。' },
  { title: '垃圾与刷屏', detail: '不发布垃圾广告、刷屏内容和批量导流信息。' },
  { title: '版权', detail: '不整段搬运侵犯版权且没有合理使用依据的内容或资源。' },
  { title: '安全研究', detail: '技术板块允许安全研究讨论，但漏洞利用细节、有效凭证、未修复目标信息需遵循负责任披露规则。' },
];

export function RulesContent() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <p className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-[var(--signal-dark)]">RULES / 社区规则</p>
      <h1 className="text-3xl font-black tracking-[-0.045em] sm:text-4xl">社区规则</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        这里是匿名讨论，但匿名不等于免责。请像对一位见过面的朋友说话那样发言。
      </p>

      <section aria-labelledby="no-go" className="mt-8 rounded-2xl border border-black/10 bg-white p-6">
        <h2 id="no-go" className="text-lg font-black tracking-tight">内容底线</h2>
        <p className="mt-1 text-sm text-muted-foreground">以下行为在全部板块都禁止，违规内容会被隐藏或删除：</p>
        <ul className="mt-4 grid gap-4">
          {ruleList.map((rule, index) => (
            <li key={rule.title} className="grid gap-1 text-sm leading-6 sm:grid-cols-[130px_minmax(0,1fr)] sm:gap-6">
              <span className="flex items-center gap-2 font-black">
                <span className="grid size-5 place-items-center rounded-full bg-[var(--signal)] font-mono text-[10px] text-[var(--ink)]">
                  {index + 1}
                </span>
                {rule.title}
              </span>
              <span className="text-muted-foreground">{rule.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="moderation" className="mt-6 rounded-2xl border border-black/10 bg-white p-6">
        <h2 id="moderation" className="text-lg font-black tracking-tight">举报与处置</h2>
        <ul className="mt-4 space-y-3 text-sm leading-6">
          <li className="rounded-xl bg-[#f8faf6] p-4">
            <p className="font-bold">看到违规内容怎么办</p>
            <p className="mt-1 text-muted-foreground">
              使用每个楼层旁的「举报」按钮，选择原因并尽量补充说明。同一内容重复举报不会加快处理，请勿刷屏举报。
            </p>
          </li>
          <li className="rounded-xl bg-[#f8faf6] p-4">
            <p className="font-bold">处置原则</p>
            <p className="mt-1 text-muted-foreground">
              按内容和行为处置，不因观点本身限流；处置使用可理解的标准原因；涉及隐私泄露的内容会优先临时隐藏再复核。
            </p>
          </li>
        </ul>
      </section>

      <section aria-labelledby="privacy" className="mt-6 rounded-2xl border border-black/10 bg-white p-6">
        <h2 id="privacy" className="text-lg font-black tracking-tight">匿名与隐私边界</h2>
        <div className="mt-4 space-y-3 text-sm leading-6">
          <p className="rounded-xl bg-[#f8faf6] p-4 text-muted-foreground">
            <span className="font-black text-foreground">我们在一个帖子里认识你，跨帖子不认识你。</span>
            同一匿名账号在同一帖子里显示固定代号（如「匿名 A3」），在不同帖子里代号不同，公开页面不展示任何可跨帖追踪的固定身份。
          </p>
          <p className="rounded-xl bg-[#f8faf6] p-4 text-muted-foreground">
            <span className="font-black text-foreground">我们尽量少保存。</span>
            无名岛不要求邮箱、手机号或姓名，不保存 IP、完整 User-Agent 或浏览器指纹。浏览历史与阅读位置默认保存在云端匿名账号下，用于跨设备续读，可随时关闭或清空。
          </p>
          <p className="rounded-xl bg-[#f8faf6] p-4 text-muted-foreground">
            <span className="font-black text-foreground">匿名是技术上的边界，不是承诺。</span>
            如果你在正文里自曝姓名、联系方式或独特经历，任何人都可能据此认出你。请先抹去内容里的个人信息再发布。
          </p>
          <p className="rounded-xl bg-[#f8faf6] p-4 text-muted-foreground">
            <span className="font-black text-foreground">可清理。</span>
            浏览历史、阅读位置和匿名身份都可以在「设置 → 隐私」中清空或销毁；销毁身份后，你的公开内容会按删除政策转为占位。
          </p>
        </div>
      </section>

      <p className="mt-8 border-t border-[var(--line)] pt-5 text-xs leading-5 text-muted-foreground">
        规则会根据社区实际情况更新，更新后会在公告中说明。对处置有疑问的匿名账号，可在设置中提交申诉说明。
      </p>
    </div>
  );
}
