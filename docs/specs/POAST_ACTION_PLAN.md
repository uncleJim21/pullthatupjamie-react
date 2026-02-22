# X-POAST Action Plan

## Overview

Fix the X-POAST feature properly by:
1. Creating new backend routes that don't require podcast ownership
2. Completely rewriting frontend to match Jamie's design language
3. Adding scheduled posts review functionality
4. Using existing upload service (don't reinvent)

## Current State

**Backend PR:** #75 (pullthatupjamie-backend)
- ❌ Uses wrong endpoint structure
- ✅ Has basic validation logic (salvageable)

**Frontend PR:** #91 (pullthatupjamie-react)
- ❌ Broken auth flow
- ❌ Wrong upload logic
- ❌ Cheap UI design
- ❌ Missing scheduled posts view
- ❌ Poor platform indicators

## Execution Strategy

### Phase 1: Backend (Sub-agent #1)

**Repository:** `pullthatupjamie-backend`
**Branch:** Create new `feature/user-social-posts-v2`
**Spec:** `POAST_BACKEND_SPEC_V2.md`

**Tasks:**
1. Create `routes/userSocialPostRoutes.js`
   - Copy auth helpers from `routes/appPreferencesRoutes.js`
   - Implement 4 routes: POST, GET, PUT, DELETE
   - Use `authenticateToken` middleware (NOT `validatePrivs`)
2. Register routes in `server.js`
3. Test all endpoints with curl commands from spec
4. Verify works for both email and provider-based auth

**Acceptance:**
- All 4 routes work
- No podcast requirement
- All curl tests pass
- Clear error messages

### Phase 2: Frontend (Sub-agent #2)

**Repository:** `pullthatupjamie-react`
**Branch:** Create new `feature/poast-v2`
**Spec:** `POAST_FRONTEND_SPEC_V2.md`

**Tasks:**
1. Complete rewrite of `src/components/PoastPage.tsx`
   - Use Tailwind classes (match SignInModal style)
   - Reuse `UploadService.processFileUpload` for media
   - iOS-style platform selection with checkmarks
   - Blue theme for Twitter, Purple for Nostr
   - Scheduled posts list with filters
2. Test locally
   - Sign in
   - Navigate to `/poast`
   - Create posts
   - Verify scheduled posts list
   - Delete posts

**Acceptance:**
- Matches Jamie's design language
- Upload works correctly
- Platform selection is clear
- Scheduled posts view works
- Mobile responsive
- No auth flow breakage

### Phase 3: Integration Testing (Me)

After both PRs are ready:
1. Pull both branches locally
2. Run backend + frontend together
3. Full flow test:
   - Sign in via Twitter
   - Create Twitter + Nostr cross-post
   - Schedule for later
   - Verify appears in list
   - Delete it
4. Edge cases:
   - Text only
   - Media only
   - Very long text for Nostr
   - Character limit for Twitter
5. Report any issues back to sub-agents for fixes

## Sub-Agent Spawn Commands

### Backend Sub-Agent

```bash
# Will create in main session after reviewing this plan
sessions_spawn(
  task="Implement user-facing social post routes per POAST_BACKEND_SPEC_V2.md. Create routes/userSocialPostRoutes.js using authenticateToken middleware. Register in server.js. Test all curl commands. Branch: feature/user-social-posts-v2",
  agentId="coding",  # or whatever coding agent we have
  cleanup="keep",
  label="poast-backend-v2"
)
```

### Frontend Sub-Agent

```bash
sessions_spawn(
  task="Complete rewrite of PoastPage component per POAST_FRONTEND_SPEC_V2.md. Match Jamie design language, reuse UploadService, add scheduled posts view. Branch: feature/poast-v2",
  agentId="coding",
  cleanup="keep",
  label="poast-frontend-v2"
)
```

## Timeline Estimate

- **Backend:** 1-2 hours (straightforward CRUD routes)
- **Frontend:** 3-4 hours (UI design + integration)
- **Integration Testing:** 30 minutes
- **Total:** 4-6 hours agent time

## Success Criteria

- [ ] Backend routes work without podcast requirement
- [ ] Frontend matches Jamie's design quality
- [ ] Upload uses existing service
- [ ] Platform selection is clear and color-coded
- [ ] Scheduled posts can be viewed and deleted
- [ ] Character counter works for Twitter
- [ ] Mobile responsive
- [ ] No regressions in sign-in flow
- [ ] All acceptance criteria from specs met

## Rollback Plan

If specs are unclear or sub-agents get stuck:
1. Kill sub-agents
2. I fix the specific blockers
3. Update specs
4. Re-spawn with clarified specs

## Post-Completion

After both PRs merged:
1. Close old PRs (#75, #91)
2. Update kanban
3. Document in MEMORY.md
4. Test on production

## Key Learnings for Future

1. **Always do discovery first** - Understand existing patterns before coding
2. **Write comprehensive specs** - Reference actual code, not generic templates
3. **Test requirements** - Document auth patterns, API contracts
4. **Design references** - Screenshot existing UI, extract actual styles
5. **Use sub-agents for execution** - Main session for planning/review only
