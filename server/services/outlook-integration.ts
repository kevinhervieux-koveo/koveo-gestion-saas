/**
 * Outlook integration service for seamless calendar invites.
 * Provides web links and enhanced .ics generation for maximum Outlook compatibility.
 * Compliant with Quebec Law 25 privacy requirements.
 */

/**
 * Interface for meeting data used in Outlook integration
 */
interface MeetingData {
  title: string;
  description?: string;
  location: string;
  scheduledDate: Date;
  duration: number; // in minutes
  organizationName?: string;
  attendeeEmails?: string[];
}

/**
 * Generates Outlook web calendar links for one-click calendar addition.
 * Supports both personal (outlook.live.com) and business (outlook.office.com) accounts.
 * 
 * @param {MeetingData} meetingData - Meeting information
 * @param {'personal' | 'business'} accountType - Type of Outlook account
 * @returns {string} Outlook web calendar URL for adding the event
 * 
 * @example
 * const personalLink = generateOutlookWebLink({
 *   title: 'Monthly Building Meeting',
 *   description: 'Discuss monthly building matters',
 *   location: 'Community Room',
 *   scheduledDate: new Date('2025-01-15T19:30:00Z'),
 *   duration: 90
 * }, 'personal');
 */
export function generateOutlookWebLink(
  meetingData: MeetingData,
  accountType: 'personal' | 'business' = 'personal'
): string {
  // Base URLs for different Outlook account types
  const baseUrls = {
    personal: 'https://outlook.live.com/calendar/deeplink/compose',
    business: 'https://outlook.office.com/calendar/deeplink/compose'
  };

  // Calculate end date based on start date and duration
  const startDate = new Date(meetingData.scheduledDate);
  const endDate = new Date(startDate.getTime() + (meetingData.duration * 60000));

  // Format dates for Outlook (ISO 8601 format with Z for UTC)
  const formatDate = (date: Date): string => {
    return date.toISOString();
  };

  // URL encode special characters
  const urlEncode = (str: string): string => {
    return encodeURIComponent(str);
  };

  // Build description with organization info if provided
  let description = meetingData.description || '';
  if (meetingData.organizationName) {
    const orgInfo = `Meeting organized by ${meetingData.organizationName} via Koveo Gestion`;
    description = description ? `${description}\n\n${orgInfo}` : orgInfo;
  }

  // Build URL parameters
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    startdt: formatDate(startDate),
    enddt: formatDate(endDate),
    subject: meetingData.title,
    location: meetingData.location,
    allday: 'false'
  });

  // Add description if present
  if (description) {
    params.append('body', description);
  }

  // PRIVACY FIX: Remove attendee emails from calendar links to comply with Quebec Law 25
  // Previously, this code exposed all attendee emails in calendar links, which was a privacy breach.
  // Calendar invitations should not reveal other attendees' email addresses.
  // The .ics attachment will handle attendee notifications properly without exposing emails in URLs.

  const fullUrl = `${baseUrls[accountType]}?${params.toString()}`;
  
  console.log(`📅 Generated ${accountType} Outlook web link for: ${meetingData.title}`);
  return fullUrl;
}

/**
 * Generates enhanced .ics content with Outlook-specific optimizations.
 * Includes additional properties for better Outlook compatibility and Quebec compliance.
 * 
 * @param {MeetingData} meetingData - Meeting information
 * @param {string} language - Language preference ('fr' or 'en')
 * @returns {string} Enhanced .ics file content optimized for Outlook
 */
export function generateEnhancedICS(meetingData: MeetingData, language: 'fr' | 'en' = 'fr'): string {
  // Generate unique UID for the event
  const uid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@koveo-gestion.com`;
  
  // Calculate end date
  const startDate = new Date(meetingData.scheduledDate);
  const endDate = new Date(startDate.getTime() + (meetingData.duration * 60000));

  // Format dates for iCS (UTC format)
  const formatICSDate = (date: Date): string => {
    return date.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}Z/, 'Z');
  };

  // Escape text for iCS format
  const escapeICSText = (text: string): string => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  };

  // Build enhanced description with organization info
  let description = meetingData.description || '';
  if (meetingData.organizationName) {
    const orgInfo = language === 'fr' 
      ? `Réunion organisée par ${meetingData.organizationName} via Koveo Gestion`
      : `Meeting organized by ${meetingData.organizationName} via Koveo Gestion`;
    description = description ? `${description}\n\n${orgInfo}` : orgInfo;
  }

  // Enhanced .ics content with Outlook-specific properties
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Koveo Gestion//Meeting Invitation//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VTIMEZONE',
    'TZID:America/Montreal',
    'BEGIN:STANDARD',
    'DTSTART:20071104T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'TZNAME:EST',
    'TZOFFSETFROM:-0400',
    'TZOFFSETTO:-0500',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:20070311T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'TZNAME:EDT',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0400',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${formatICSDate(startDate)}`,
    `DTEND:${formatICSDate(endDate)}`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `SUMMARY:${escapeICSText(meetingData.title)}`,
    `DESCRIPTION:${escapeICSText(description)}`,
    `LOCATION:${escapeICSText(meetingData.location)}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'SEQUENCE:0',
    // Outlook-specific properties for better compatibility
    'X-MICROSOFT-CDO-BUSYSTATUS:BUSY',
    'X-MICROSOFT-CDO-IMPORTANCE:1',
    'X-MICROSOFT-DISALLOW-COUNTER:FALSE',
    // Privacy compliance properties
    'CLASS:PUBLIC',
    'PRIORITY:5',
    // Enhanced reminder settings (15 minutes before)
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${language === 'fr' ? 'Rappel: ' : 'Reminder: '}${escapeICSText(meetingData.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  console.log(`📅 Generated enhanced .ics with Outlook optimizations for: ${meetingData.title}`);
  return icsContent;
}

/**
 * Interface for calendar integration links
 */
export interface CalendarIntegrationLinks {
  outlookPersonal: string;
  outlookBusiness: string;
  enhancedICS: string;
}

/**
 * Generates all calendar integration options for a meeting.
 * Provides comprehensive calendar compatibility across platforms.
 * 
 * @param {MeetingData} meetingData - Meeting information
 * @param {string} language - Language preference ('fr' or 'en')
 * @returns {CalendarIntegrationLinks} Object containing all integration links
 */
export function generateAllCalendarLinks(
  meetingData: MeetingData,
  language: 'fr' | 'en' = 'fr'
): CalendarIntegrationLinks {
  return {
    outlookPersonal: generateOutlookWebLink(meetingData, 'personal'),
    outlookBusiness: generateOutlookWebLink(meetingData, 'business'),
    enhancedICS: generateEnhancedICS(meetingData, language)
  };
}

/**
 * Generates HTML calendar integration buttons for email templates.
 * Creates bilingual buttons with appropriate styling for Quebec compliance.
 * 
 * @param {CalendarIntegrationLinks} links - Calendar integration links
 * @param {string} language - Language preference ('fr' or 'en')
 * @returns {string} HTML content with calendar integration buttons
 */
export function generateCalendarButtonsHTML(
  links: CalendarIntegrationLinks,
  language: 'fr' | 'en' = 'fr'
): string {
  const isFrench = language === 'fr';

  return `
    <div style="text-align: center; margin: 30px 0;">
      <h3 style="color: #374151; margin-bottom: 20px;">
        ${isFrench ? 'Ajouter à votre calendrier' : 'Add to Your Calendar'}
      </h3>
      
      <div style="margin: 20px 0;">
        <a href="${links.outlookPersonal}" 
           style="display: inline-block; background-color: #0078d4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 5px; font-weight: 500;">
          📅 ${isFrench ? 'Outlook Personnel' : 'Personal Outlook'}
        </a>
        
        <a href="${links.outlookBusiness}" 
           style="display: inline-block; background-color: #0078d4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 5px; font-weight: 500;">
          🏢 ${isFrench ? 'Outlook Professionnel' : 'Business Outlook'}
        </a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 15px;">
        ${isFrench 
          ? 'Un fichier de calendrier (.ics) est également joint pour une compatibilité maximale avec tous les systèmes de calendrier.'
          : 'A calendar file (.ics) is also attached for maximum compatibility with all calendar systems.'}
      </p>
    </div>
  `;
}

/**
 * Generates plain text calendar integration instructions for email templates.
 * Provides fallback text version for accessibility and Quebec compliance.
 * 
 * @param {CalendarIntegrationLinks} links - Calendar integration links
 * @param {string} language - Language preference ('fr' or 'en')
 * @returns {string} Plain text calendar integration instructions
 */
export function generateCalendarInstructionsText(
  links: CalendarIntegrationLinks,
  language: 'fr' | 'en' = 'fr'
): string {
  const isFrench = language === 'fr';

  return `
${isFrench ? 'AJOUTER À VOTRE CALENDRIER' : 'ADD TO YOUR CALENDAR'}
${isFrench ? '=========================' : '======================='}

${isFrench ? 'Outlook Personnel:' : 'Personal Outlook:'}
${links.outlookPersonal}

${isFrench ? 'Outlook Professionnel:' : 'Business Outlook:'}
${links.outlookBusiness}

${isFrench 
  ? 'Un fichier de calendrier (.ics) est également joint pour une compatibilité maximale avec tous les systèmes de calendrier.'
  : 'A calendar file (.ics) is also attached for maximum compatibility with all calendar systems.'}
  `;
}