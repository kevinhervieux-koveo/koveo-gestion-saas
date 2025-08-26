/// <reference types='../../../types/browser-apis' />
import { useState } from 'react';
import type { ReactNode } from 'react';
import Uppy from '@uppy/core';
import { DashboardModal } from '@uppy/react';
import '@uppy/core/dist/style.min.css';
import '@uppy/dashboard/dist/style.min.css';
import AwsS3 from '@uppy/aws-s3';
import type { UploadResult } from '@uppy/core';
import { Button } from '@/components/ui/button';

/**
 * Props interface for ObjectUploader component.
 */
interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{
    method: 'PUT';
    url: string;
  }>;
  onComplete?: (_result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => void;
  buttonClassName?: string;
  children: ReactNode;
}

/**
 * A file upload component that renders as a button and provides a modal interface for file management.
 *
 * @param root0 - Component props object.
 * @param root0.maxNumberOfFiles - Maximum number of files allowed (default: 1).
 * @param root0.maxFileSize - Maximum file size in bytes (default: 10MB).
 * @param root0.onGetUploadParameters - Function to get upload parameters (method and URL).
 * @param root0.onComplete - Callback function called when upload is complete.
 * @param root0.buttonClassName - Optional CSS class name for the button.
 * @param root0.children - Content to be rendered inside the button.
 * @returns JSX element for file upload component.
 */
/**
 * ObjectUploader component.
 * @param props - Component props.
 * @param props.maxNumberOfFiles = 1 - maxNumberOfFiles = 1 parameter.
 * @param props.maxFileSize = 10485760 - maxFileSize = 10485760 parameter.
 * @param props.// 10MB default
  onGetUploadParameters - // 10MB default
  onGetUploadParameters parameter.
 * @param props.onComplete - onComplete parameter.
 * @param props.buttonClassName - buttonClassName parameter.
 * @param props.children - React children elements.
 * @returns JSX element.
 */
/**
 * Object uploader function.
 * @param {
  maxNumberOfFiles = 1 - {
  maxNumberOfFiles = 1 parameter.
 * @param maxFileSize = 10485760 - maxFileSize = 10485760 parameter.
 * @param // 10MB default
  onGetUploadParameters - // 10MB default
  onGetUploadParameters parameter.
 * @param onComplete - onComplete parameter.
 * @param buttonClassName - buttonClassName parameter.
 * @param children - children parameter.
 * @param } - } parameter.
 */
export function  /**
   * Object uploader function.
   * @param {
  maxNumberOfFiles = 1 - {
  maxNumberOfFiles = 1 parameter.
   * @param maxFileSize = 10485760 - maxFileSize = 10485760 parameter.
   * @param // 10MB default
  onGetUploadParameters - // 10MB default
  onGetUploadParameters parameter.
   * @param onComplete - onComplete parameter.
   * @param buttonClassName - buttonClassName parameter.
   * @param children - children parameter.
   * @param } - } parameter.
   */  /**
   * Object uploader function.
   * @param {
  maxNumberOfFiles = 1 - {
  maxNumberOfFiles = 1 parameter.
   * @param maxFileSize = 10485760 - maxFileSize = 10485760 parameter.
   * @param // 10MB default
  onGetUploadParameters - // 10MB default
  onGetUploadParameters parameter.
   * @param onComplete - onComplete parameter.
   * @param buttonClassName - buttonClassName parameter.
   * @param children - children parameter.
   * @param } - } parameter.
   */  /**
   * Object uploader function.
   * @param {
  maxNumberOfFiles = 1 - {
  maxNumberOfFiles = 1 parameter.
   * @param maxFileSize = 10485760 - maxFileSize = 10485760 parameter.
   * @param // 10MB default
  onGetUploadParameters - // 10MB default
  onGetUploadParameters parameter.
   * @param onComplete - onComplete parameter.
   * @param buttonClassName - buttonClassName parameter.
   * @param children - children parameter.
   * @param } - } parameter.
   */


 ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760, // 10MB default
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize,
      },
      autoProceed: false,
    })
      .use(AwsS3, {
        shouldUseMultipart: false,
        getUploadParameters: onGetUploadParameters,
      })
      .on('complete', (_result) => {
        onComplete?.(_result);
      })
  );

  return (
    <div>
      <Button onClick={() => setShowModal(true)} className={buttonClassName}>
        {children}
      </Button>

      <DashboardModal
        uppy={uppy}
        open={showModal}
        onRequestClose={() => setShowModal(false)}
        proudlyDisplayPoweredByUppy={false}
      />
    </div>
  );
}
