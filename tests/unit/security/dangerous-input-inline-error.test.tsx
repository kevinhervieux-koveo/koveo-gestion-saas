/**
 * Frontend coverage for Task #166: when the backend rejects a
 * request with `{ code: 'DANGEROUS_INPUT', fieldPath, message }`, the
 * auth forms attach the error inline via `applyDangerousInputFieldError`
 * and the invitation wizard's profile step renders the field-named
 * French message under the offending input.
 */

import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { ApiError } from '../../../client/src/lib/queryClient';
import { applyDangerousInputFieldError } from '../../../client/src/lib/form-errors';
import { ProfileCompletionStep } from '../../../client/src/components/auth/steps/profile-completion-step';

jest.mock('../../../client/src/hooks/use-language', () => ({
  useLanguage: () => ({ t: (k: string) => k, language: 'fr' }),
}));

function buildDangerousInputError(fieldPath: string, message: string) {
  return new ApiError(message, {
    status: 400,
    body: { code: 'DANGEROUS_INPUT', fieldPath, message },
    code: 'DANGEROUS_INPUT',
    fieldPath,
    fieldLabel: 'Prénom',
  });
}

describe('applyDangerousInputFieldError', () => {
  it('pins a server field error to a registered RHF control', () => {
    const { result } = renderHook(() =>
      useForm<{ email: string }>({ defaultValues: { email: '' } }),
    );
    // register the field so RHF's control._names.mount knows about it
    result.current.register('email');

    const applied = applyDangerousInputFieldError(
      buildDangerousInputError('email', 'Le champ « E-mail » contient des caractères non autorisés.'),
      result.current,
    );

    expect(applied).toBe(true);
    expect(result.current.getFieldState('email').error?.message).toMatch(
      /caractères non autorisés/,
    );
  });

  it('returns false when the fieldPath does not match any registered control', () => {
    const { result } = renderHook(() =>
      useForm<{ email: string }>({ defaultValues: { email: '' } }),
    );
    result.current.register('email');

    const applied = applyDangerousInputFieldError(
      buildDangerousInputError('unknownField', 'boom'),
      result.current,
    );

    expect(applied).toBe(false);
    expect(result.current.formState.errors.email).toBeUndefined();
  });

  it('ignores non-DANGEROUS_INPUT errors', () => {
    const { result } = renderHook(() =>
      useForm<{ email: string }>({ defaultValues: { email: '' } }),
    );
    result.current.register('email');

    const plain = new ApiError('nope', { status: 500 });
    expect(applyDangerousInputFieldError(plain, result.current)).toBe(false);
  });
});

describe('ProfileCompletionStep submissionError', () => {
  it('renders the server-supplied French message under the matching input', () => {
    render(
      <ProfileCompletionStep
        _data={{ firstName: 'Él', lastName: 'Doe', language: 'fr' }}
        onDataChange={() => {}}
        onValidationChange={() => {}}
        onNext={() => {}}
        onPrevious={() => {}}
        isActive={true}
        submissionError={{
          fieldPath: 'firstName',
          message:
            'Le champ « Prénom » contient des caractères non autorisés. Veuillez le modifier.',
        }}
      />,
    );

    const errorNode = screen.getByText(
      /Le champ « Prénom » contient des caractères non autorisés/,
    );
    expect(errorNode).toBeInTheDocument();

    // The matching Input gains the red-500 border class so the user
    // sees a visual cue even before reading the message.
    const firstNameInput = screen.getByPlaceholderText('Votre prénom');
    expect(firstNameInput.className).toMatch(/border-red-500/);
  });

  it('leaves other inputs unaffected when the error targets one field', () => {
    render(
      <ProfileCompletionStep
        _data={{ firstName: 'Él', lastName: 'Doe', language: 'fr' }}
        onDataChange={() => {}}
        onValidationChange={() => {}}
        onNext={() => {}}
        onPrevious={() => {}}
        isActive={true}
        submissionError={{
          fieldPath: 'firstName',
          message: 'Le champ « Prénom » contient des caractères non autorisés.',
        }}
      />,
    );

    const lastNameInput = screen.getByPlaceholderText('Votre nom de famille');
    expect(lastNameInput.className).not.toMatch(/border-red-500/);
  });
});

// Minimal renderHook shim — @testing-library/react-hooks is not a dep;
// React Testing Library's own `renderHook` ships with v13+.
import { renderHook } from '@testing-library/react';
