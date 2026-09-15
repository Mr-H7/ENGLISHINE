import { Outlet } from 'react-router';
import { Container, ContentWrapper } from '@/components/layout/Container';
import { PageTransition } from '@/components/PageTransition';
import { ShellFrame } from '@/layouts/ShellFrame';

export function Component() {
  return (
    <ShellFrame layout="marketing">
      <Container>
        <main id="main-content" className="ui-main">
          <ContentWrapper>
            <PageTransition>
              <Outlet />
            </PageTransition>
          </ContentWrapper>
        </main>
      </Container>
    </ShellFrame>
  );
}
