public with sharing class FileUploadService {
    
    @AuraEnabled                            
    public static Id saveTheChunkFile(Id parentId, String fileName, String base64Data, String contentType, String fileId){
        
        base64Data = EncodingUtil.urlDecode(base64Data, 'UTF-8');
        if ( String.isBlank(fileId) ) {
            fileId = saveFiles(parentId, fileName, base64Data );
        } else {
            appendToFile(fileId, base64Data);
        }

        return Id.valueOf(fileId);
    }

    @AuraEnabled
    public static Id saveFiles(Id recordId, String fileName, String base64Data )  { 
        
        ContentVersion contentToInsert =new ContentVersion(); 
        contentToInsert.Title =fileName; 
        contentToInsert.VersionData=EncodingUtil.base64Decode(base64Data);
        contentToInsert.PathOnClient='CustomPDF.pdf' ;
        contentToInsert.IsMajorVersion = false;
		contentToInsert.Title = 'ConvertedtoPDF';
	    insert contentToInsert; 
        
        contentToInsert = [select id, ContentDocumentId from ContentVersion WHERE Id =: contentToInsert.Id];
        ContentDocumentLink cl = new ContentDocumentLink();
        cl.ContentDocumentId = contentToInsert.ContentDocumentId;
        cl.LinkedEntityId = recordId; 
        cl.ShareType = 'V';
        cl.Visibility = 'AllUsers';
        insert cl;
        
        return contentToInsert.id;

    }


    @AuraEnabled
    public static void appendToFile(Id contentDocumentId, String base64Data) {
        //base64Data = EncodingUtil.urlDecode(base64Data, 'UTF-8');
        ContentVersion versionData = [
            SELECT Id, VersionData,ContentDocumentId
            FROM ContentVersion
            WHERE Id = :contentDocumentId
        ];

        String existingBody     = EncodingUtil.base64Encode(versionData.VersionData);
        versionData.VersionData = EncodingUtil.base64Decode(existingBody + base64Data); 

        update versionData;
    }

    @AuraEnabled
    public static List<FileDescriptor> getEntityRecordFiles(List<String> listIds) {
		List<FileDescriptor> files = new List<FileDescriptor>();
		Set<Id> recordIds = new Set<Id>();
		for(String i:listIds){
			recordIds.add(i);
		}
		if (recordIds.size() == 0) {
			return files;
		}
		Map<Id,ContentVersion> versionsMap = new Map<Id, ContentVersion>([
		SELECT Id,VersionData, Title, ContentDocumentId, FileExtension
		FROM ContentVersion
		WHERE Id = :recordIds AND IsLatest = TRUE
		WITH SECURITY_ENFORCED
		]);
		for(String versionId : listIds){
		ContentVersion cv =	versionsMap.get(versionId);
			FileDescriptor data = new FileDescriptor();
			data.Content = EncodingUtil.base64Encode(cv.VersionData);
			data.ContentType = ContentType(cv.FileExtension);
			data.ContentDocumentId = cv.ContentDocumentId;
			files.add(data);
		}
		
		return files;
	}
    public static string ContentType(string fileType) {
		switch on fileType.toLowerCase() {
			when 'docx' {
				return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
			}
			when 'csv' {
				return 'application/vnd.ms-excel';
			}
			when 'wav' {
				return 'audio/wav';
			}
			when 'wmv' {
				return 'video/x-ms-wmv';
			}
			when 'mp3' {
				return 'audio/mpeg';
			}
			when 'mp4' {
				return 'video/mp4';
			}
			when 'png' {
				return 'image/png';
			}
			when 'pdf' {
				return 'application/pdf';
			}
			when else {
				return 'image/jpeg';
			}
		}
	}
}